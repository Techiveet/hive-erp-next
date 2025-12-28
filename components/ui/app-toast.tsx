"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
  XCircle,
} from "lucide-react";

import { toast } from "sonner";

type ToastVariant = "success" | "error" | "warning" | "info" | "loading";

const styles: Record<Exclude<ToastVariant, "loading">, { icon: any; className: string }> = {
  success: {
    icon: CheckCircle2,
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-900 [&_[data-title]]:text-emerald-900",
  },
  error: {
    icon: XCircle,
    className:
      "border-red-200 bg-red-50 text-red-900 [&_[data-title]]:text-red-900",
  },
  warning: {
    icon: AlertTriangle,
    className:
      "border-amber-200 bg-amber-50 text-amber-900 [&_[data-title]]:text-amber-900",
  },
  info: {
    icon: Info,
    className:
      "border-sky-200 bg-sky-50 text-sky-900 [&_[data-title]]:text-sky-900",
  },
};

export const AppToast = {
  success(title: string, description?: string) {
    const Icon = styles.success.icon;
    return toast(title, {
      description,
      icon: <Icon className="h-4 w-4" />,
      className: `rounded-2xl shadow-lg border ${styles.success.className}`,
      duration: 3500,
    });
  },

  error(title: string, description?: string) {
    const Icon = styles.error.icon;
    return toast(title, {
      description,
      icon: <Icon className="h-4 w-4" />,
      className: `rounded-2xl shadow-lg border ${styles.error.className}`,
      duration: 4500,
    });
  },

  warning(title: string, description?: string) {
    const Icon = styles.warning.icon;
    return toast(title, {
      description,
      icon: <Icon className="h-4 w-4" />,
      className: `rounded-2xl shadow-lg border ${styles.warning.className}`,
      duration: 4000,
    });
  },

  info(title: string, description?: string) {
    const Icon = styles.info.icon;
    return toast(title, {
      description,
      icon: <Icon className="h-4 w-4" />,
      className: `rounded-2xl shadow-lg border ${styles.info.className}`,
      duration: 3500,
    });
  },

  loading(title: string, description?: string) {
    return toast(title, {
      description,
      icon: <Loader2 className="h-4 w-4 animate-spin" />,
      className:
        "rounded-2xl shadow-lg border border-slate-200 bg-white text-slate-900",
      duration: Infinity,
    });
  },

  dismiss(id?: string | number) {
    if (id) toast.dismiss(id);
    else toast.dismiss();
  },
};
