import type { Metadata } from "next";

// The kid surface (/me) is its own installable Chrome app, distinct from the
// parent app. Overriding the manifest + icons here means that when a child
// installs from their phone they get "My Jobs" with the green star icon, while
// a parent installing from the dashboard gets "Family Board".
export const metadata: Metadata = {
  title: "My Jobs",
  applicationName: "My Jobs",
  manifest: "/manifest-kid.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "My Jobs",
  },
  icons: {
    icon: [{ url: "/icon-kid.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icon-kid.svg" }],
  },
};

export default function ChildLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
