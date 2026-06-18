"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    if (process.env.NODE_ENV !== "production") {
      return;
    }

    // Si una versión nueva del SW toma el control de una página que YA estaba
    // controlada por una versión vieja (típico tras un deploy), recargamos una
    // sola vez para levantar los assets nuevos. Sin esto la PWA queda "pegada"
    // en la versión vieja y la página se ve pero no responde.
    // No recarga en la primera instalación: ahí no había controller previo.
    const hadController = Boolean(navigator.serviceWorker.controller);
    let refreshing = false;
    const onControllerChange = () => {
      if (refreshing || !hadController) {
        return;
      }
      refreshing = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      onControllerChange,
    );

    const checkForUpdate = () => {
      navigator.serviceWorker
        .getRegistration()
        .then((registration) => registration?.update())
        .catch(() => {});
    };

    // Cuando la pestaña vuelve a foco, buscamos una versión nueva para no
    // depender del chequeo perezoso del navegador (PWA abierta mucho tiempo).
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        checkForUpdate();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    const onLoad = () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          // Buscar una versión nueva ni bien registramos.
          registration.update().catch(() => {});
        })
        .catch(() => {
          // Silent fail: the app keeps working without offline support.
        });
    };

    if (document.readyState === "complete") {
      onLoad();
    } else {
      window.addEventListener("load", onLoad, { once: true });
    }

    return () => {
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange,
      );
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("load", onLoad);
    };
  }, []);

  return null;
}
