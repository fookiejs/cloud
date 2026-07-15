import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Download, Smartphone } from "lucide-react";
import { useParams } from "react-router-dom";
import { SensitiveField, SensitiveReveal } from "@/components/SensitiveField";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/useSession";
import { buildMobileQrData } from "@/lib/api";

export function MobilePage() {
  const params = useParams();
  let projectId: string | null = null;
  if (typeof params["projectId"] === "string" && params["projectId"].length > 0) {
    projectId = params["projectId"];
  }
  const session = useSession();

  const mobileUri = session ? buildMobileQrData(session) : null;

  type ApkRelease =
    | { available: false }
    | { available: true; downloadUrl: string; sizeBytes: number; fileName: string };

  const [apkRelease, setApkRelease] = useState<ApkRelease | null>(null);

  useEffect(() => {
    let active = true;
    async function loadApkRelease() {
      try {
        const response = await fetch("/mobile/release");
        if (!response.ok) return;
        const data = (await response.json()) as ApkRelease;
        if (active) setApkRelease(data);
      } catch {
        if (active) setApkRelease({ available: false });
      }
    }
    void loadApkRelease();
    return () => {
      active = false;
    };
  }, []);

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
  }

  let apkDownloadUrl: string | null = null;
  let apkFileName: string | null = null;
  let apkSizeBytes: number | null = null;
  if (apkRelease !== null && apkRelease.available) {
    apkDownloadUrl = apkRelease.downloadUrl;
    apkFileName = apkRelease.fileName;
    apkSizeBytes = apkRelease.sizeBytes;
  }

  let projectLabel = "Project";
  if (session !== null && session.projectName !== null) {
    projectLabel = session.projectName;
  } else if (projectId !== null) {
    projectLabel = projectId;
  }
  let projectTasksPath = "/projects";
  if (projectId !== null) {
    projectTasksPath = `/projects/${projectId}/tasks`;
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        breadcrumb={[
          { label: "Projects", to: "/projects" },
          {
            label: projectLabel,
            to: projectTasksPath,
          },
          { label: "Mobile", to: null },
        ]}
        title="Mobile"
        subtitle="Connect the Android app"
      />

      <div className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto max-w-xl space-y-8">
          <div className="panel-card space-y-6 p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
                <Smartphone className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-white">Connect mobile app</p>
                <p className="text-sm text-muted-foreground">
                  Scan the QR code in the Android app to sign in instantly.
                </p>
              </div>
            </div>

            {mobileUri ? (
              <SensitiveReveal label="Show QR code" hideLabel="Hide QR">
                <div className="flex flex-col items-center gap-4">
                  <div className="inline-flex rounded-2xl bg-white p-4 shadow-sm">
                    <QRCodeSVG value={mobileUri} size={240} level="L" includeMargin />
                  </div>
                  <p className="text-center text-xs leading-relaxed text-muted-foreground">
                    Scan with the Task Bridge Android app. The QR encodes your personal token — keep it private.
                  </p>
                </div>
              </SensitiveReveal>
            ) : null}

            <div className="space-y-3">
              <SensitiveField
                label="Deep link"
                value={mobileUri !== null ? mobileUri : "-"}
                onCopy={mobileUri ? () => void copy(mobileUri) : null}
              />
            </div>
          </div>

          {apkDownloadUrl !== null && apkFileName !== null ? (
            <div className="panel-card space-y-4 p-6">
              <div className="flex flex-wrap items-center gap-3">
                <Button asChild>
                  <a href={apkDownloadUrl} download={apkFileName}>
                    <Download className="mr-2 h-4 w-4" />
                    Download APK
                  </a>
                </Button>
                {apkSizeBytes !== null && apkSizeBytes > 0 ? (
                  <span className="text-sm text-muted-foreground">
                    {(apkSizeBytes / (1024 * 1024)).toFixed(1)} MB
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
