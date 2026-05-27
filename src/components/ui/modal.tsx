import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import styles from "./modal.module.css";

type ModalProps = {
  title: string;
  children: ReactNode;
  open: boolean;
  onClose?: () => void;
};

export function Modal({ title, children, open, onClose }: ModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className={styles.backdrop} role="presentation">
      <section
        aria-labelledby="modal-title"
        aria-modal="true"
        className={styles.modal}
        role="dialog"
      >
        <div className={styles.header}>
          <h2 id="modal-title">{title}</h2>
          {onClose ? (
            <Button aria-label="Close modal" onClick={onClose} variant="ghost">
              Close
            </Button>
          ) : null}
        </div>
        <div>{children}</div>
      </section>
    </div>
  );
}
