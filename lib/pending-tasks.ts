const pendingControllers = new Set<AbortController>();

export function createPendingTaskSignal() {
  const controller = new AbortController();
  pendingControllers.add(controller);

  const release = () => {
    pendingControllers.delete(controller);
  };

  controller.signal.addEventListener("abort", release, { once: true });

  return controller.signal;
}

export function cancelAllPendingTasks() {
  pendingControllers.forEach((controller) => {
    controller.abort();
  });

  pendingControllers.clear();
}

export const UNSAVED_DRAFT_STORAGE_KEY = "cotizapp:unsaved-draft";

export function markUnsavedDraft(active: boolean) {
  if (typeof window === "undefined") {
    return;
  }

  if (active) {
    window.sessionStorage.setItem(UNSAVED_DRAFT_STORAGE_KEY, "1");
    return;
  }

  window.sessionStorage.removeItem(UNSAVED_DRAFT_STORAGE_KEY);
}

export function hasUnsavedDraft() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.sessionStorage.getItem(UNSAVED_DRAFT_STORAGE_KEY) === "1";
}
