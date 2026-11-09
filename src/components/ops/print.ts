/** The two print desks: A4 poster on the Apeos, 95 × 110 mm label on the label printer. */
export type PrintFormat = "a4" | "label";

export const PRINT = {
  a4: { label: "Print A4", path: (id: string) => `/print/${id}`, action: "printed" },
  label: { label: "Print Label", path: (id: string) => `/print/${id}/label`, action: "label" },
} as const;

/**
 * Prints an operator print page through a hidden iframe so the operator never
 * leaves the screen they are on. Resolves once the print dialog has closed (or,
 * with --kiosk-printing, once the job has been handed to the printer).
 */
export function printInFrame(frame: HTMLIFrameElement, id: string, format: PrintFormat) {
  return new Promise<void>((resolve) => {
    frame.onload = async () => {
      // Wait for the signature font, then a beat for layout.
      await frame.contentDocument?.fonts.ready;
      setTimeout(() => {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
        resolve();
      }, 400);
    };
    frame.src = `${PRINT[format].path(id)}?embed=1`;
  });
}
