"use client";

import { PARTY_CAP } from "@party/protocol";
import { onRtc, sendRtc } from "./party-client";
import { partyPoses, usePartyStore } from "./party-store";

/**
 * Proximity voice: you hear the bees near you.
 *
 * A full mesh, which is the right shape at this size and the wrong shape at any
 * other. Nine peer connections each way is fine; ninety would not be, and the
 * ten-seat cap is what makes the mesh honest. It also means no audio server:
 * voices go browser to browser, the party socket carries only the offers and
 * ICE candidates, and nothing about a conversation touches Cloudflare beyond
 * the handshake. That is a privacy property and a free-tier property at once.
 *
 * The mic is never opened without being asked for. `startVoice` is called from
 * a button, and the browser's own permission prompt is the second gate.
 *
 * **Distance is applied here, not by the WebAudio panner.** A PannerNode wants a
 * listener orientation and a per-frame position update per source, and gives us
 * head-relative stereo we do not want: the camera is behind the bee, so a voice
 * panned hard left is confusing rather than informative. A plain GainNode driven
 * by distance says the one thing that matters, which is who is close enough to
 * talk to.
 */

/** Full volume within this many world units. About a flower patch across. */
const NEAR = 12;

/** Silent beyond this. Roughly the far side of a clearing. */
const FAR = 70;

export function voiceGainFor(distance: number): number {
  if (!Number.isFinite(distance) || distance <= NEAR) {
    return 1;
  }

  if (distance >= FAR) {
    return 0;
  }

  // Linear in distance between the two, then squared so it falls away the way
  // loudness actually does rather than sounding like a fader.
  const t = 1 - (distance - NEAR) / (FAR - NEAR);

  return t * t;
}

type Peer = {
  connection: RTCPeerConnection;
  gain: GainNode;
  /** Kept alive because a MediaStreamAudioSourceNode is garbage in Chrome if
   *  its element is collected. The muted element is the reliable way. */
  element: HTMLAudioElement;
};

const peers = new Map<string, Peer>();

let context: AudioContext | null = null;
let microphone: MediaStream | null = null;
let live = false;
/** Stops watching the room when the mic goes off. */
let unsubscribe: (() => void) | null = null;

/** Google's public STUN. No TURN: a relay would be a bill and a third party in
 *  the middle of a conversation. Mesh voice fails on hostile NATs, and that is
 *  an acceptable failure for a game about looking at flowers. */
const ICE: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export function voiceIsLive() {
  return live;
}

export async function startVoice(): Promise<boolean> {
  if (live) {
    return true;
  }

  try {
    microphone = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
  } catch {
    // Refused, or no microphone. Not an error worth breaking the park over.
    return false;
  }

  context = new AudioContext();
  live = true;

  onRtc(handleSignal);

  announce();

  /**
   * And keep up with the room as it changes.
   *
   * Without this, voice only ever reached whoever happened to be standing there
   * when you unmuted: somebody arriving afterwards would be visible, audible to
   * nobody, and there is no way to tell that apart from them simply being
   * quiet. Leaving is the other half, and it has to close the connection rather
   * than let it rot, or a peer who left is an `RTCPeerConnection` retrying ICE
   * for as long as the tab is open.
   */
  unsubscribe = usePartyStore.subscribe((state) => {
    const here = new Set(state.others.map((other) => other.sub));

    for (const sub of peers.keys()) {
      if (!here.has(sub)) {
        dropVoice(sub);
      }
    }

    announce();
  });

  return true;
}

/**
 * Say "my microphone is on" to the room.
 *
 * **Nobody offers to a peer who has not said this**, and that is the whole point
 * of it. Offering blind does not work: the offer is delivered through the party
 * socket to a client that has not registered an RTC handler yet, so it is
 * dropped on the floor, and the glare tie-break then stops the other side from
 * ever offering back. Whoever unmuted second was connected to nobody, silently,
 * and silence is exactly what voice chat looks like when it is working.
 *
 * The reply matters as much as the announcement. If you unmute first, your
 * announcement lands on people who are not listening yet; theirs, later, is what
 * tells you they are there, and the acknowledgement is what tells them you are.
 * Acks are not acked, so this settles in one round trip.
 */
function announce() {
  if (!live) {
    return;
  }

  for (const other of usePartyStore.getState().others.slice(0, PARTY_CAP)) {
    sendRtc(other.sub, { kind: "voice-here" });
  }
}

/**
 * Who offers, once both sides are known to be listening.
 *
 * The tie-break is by id and it is load-bearing: two players who unmute at the
 * same moment would otherwise both send an offer and both reject the other's,
 * which is WebRTC glare and deadlocks roughly half the time. The lower id
 * offers, the higher waits.
 */
function maybeOfferTo(sub: string) {
  const you = usePartyStore.getState().you?.sub ?? "";

  if (live && you < sub && !peers.has(sub)) {
    void offerTo(sub);
  }
}

export function stopVoice() {
  live = false;

  unsubscribe?.();
  unsubscribe = null;

  for (const [sub, peer] of peers) {
    peer.connection.close();
    peer.element.srcObject = null;
    peers.delete(sub);
  }

  microphone?.getTracks().forEach((track) => track.stop());
  microphone = null;

  void context?.close();
  context = null;
}

function peerFor(sub: string): Peer {
  const existing = peers.get(sub);

  if (existing) {
    return existing;
  }

  const connection = new RTCPeerConnection(ICE);
  const gain = context!.createGain();

  gain.gain.value = 0;
  gain.connect(context!.destination);

  const element = new Audio();
  element.muted = true;
  element.autoplay = true;

  connection.addEventListener("icecandidate", (event) => {
    if (event.candidate) {
      sendRtc(sub, { kind: "ice", candidate: event.candidate.toJSON() });
    }
  });

  connection.addEventListener("track", (event) => {
    const [stream] = event.streams;

    element.srcObject = stream;
    void element.play().catch(() => {});
    context!.createMediaStreamSource(stream).connect(gain);
  });

  microphone?.getTracks().forEach((track) => {
    connection.addTrack(track, microphone!);
  });

  const peer: Peer = { connection, gain, element };
  peers.set(sub, peer);

  return peer;
}

async function offerTo(sub: string) {
  const peer = peerFor(sub);
  const offer = await peer.connection.createOffer();

  await peer.connection.setLocalDescription(offer);
  sendRtc(sub, { kind: "offer", sdp: offer });
}

async function handleSignal(from: string, payload: unknown) {
  if (!live || !payload || typeof payload !== "object") {
    return;
  }

  const message = payload as {
    kind?: string;
    sdp?: RTCSessionDescriptionInit;
    candidate?: RTCIceCandidateInit;
  };

  // Somebody's microphone came on. Tell them mine is too, then let the tie-break
  // decide which of us offers. Handled before `peerFor`, which would otherwise
  // build a connection to somebody we may not end up calling.
  if (message.kind === "voice-here") {
    sendRtc(from, { kind: "voice-ack" });
    maybeOfferTo(from);

    return;
  }

  // Their answer to ours. Same decision, from the other side of the race.
  if (message.kind === "voice-ack") {
    maybeOfferTo(from);

    return;
  }

  const peer = peerFor(from);

  try {
    if (message.kind === "offer" && message.sdp) {
      await peer.connection.setRemoteDescription(message.sdp);

      const answer = await peer.connection.createAnswer();

      await peer.connection.setLocalDescription(answer);
      sendRtc(from, { kind: "answer", sdp: answer });
      return;
    }

    if (message.kind === "answer" && message.sdp) {
      await peer.connection.setRemoteDescription(message.sdp);
      return;
    }

    if (message.kind === "ice" && message.candidate) {
      await peer.connection.addIceCandidate(message.candidate);
    }
  } catch {
    // A failed handshake drops that one voice, not the party.
  }
}

/** A player left, or muted. Tear their connection down. */
export function dropVoice(sub: string) {
  const peer = peers.get(sub);

  if (!peer) {
    return;
  }

  peer.connection.close();
  peer.element.srcObject = null;
  peers.delete(sub);
}

/**
 * Called from the frame loop with the player's own position. Sets each voice's
 * gain from how far away that bee is right now.
 *
 * Ramped rather than assigned: a gain that jumps on a frame boundary clicks,
 * and flying past someone would crackle. Twelfth-of-a-second ramps are
 * inaudible as ramps and remove the click entirely.
 */
export function updateVoiceDistances(x: number, z: number, altitude: number) {
  if (!live || !context) {
    return;
  }

  for (const [sub, peer] of peers) {
    const pose = partyPoses.get(sub);

    if (!pose) {
      continue;
    }

    const distance = Math.hypot(
      pose.x - x,
      pose.altitude - altitude,
      pose.z - z,
    );

    peer.gain.gain.setTargetAtTime(
      voiceGainFor(distance),
      context.currentTime,
      0.08,
    );
  }
}
