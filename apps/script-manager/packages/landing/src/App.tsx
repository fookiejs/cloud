import { Box, Braces, Clock, FolderOpen, Github, Layers, Radio, Terminal, Zap } from 'lucide-react';
import { CopyCommand } from '@/components/copy-command';
import { SiteHeader } from '@/components/site-header';
import { ProductPreview } from '@/components/product-preview';
import { cn } from '@/lib/utils';

const GITHUB_URL = 'https://github.com/umudik/lotaru';

const features = [
  {
    icon: Zap,
    title: 'Triggers that fit your flow',
    body: 'Manual runs, on file save, startup, or cron schedules mix and match per task.',
  },
  {
    icon: Terminal,
    title: 'Shell & Docker',
    body: 'Run npm, gh, ollama on your machine, or isolate work in containers when you need it.',
  },
  {
    icon: Radio,
    title: 'Live logs in the browser',
    body: 'Task and Logs tabs keep editing and output separate. Stream runs in real time or replay history.',
  },
  {
    icon: FolderOpen,
    title: 'Local-first',
    body: 'Your projects stay on disk. State lives in ~/.lotaru/ no cloud account required.',
  },
  {
    icon: Braces,
    title: 'Import & export',
    body: 'Move whole projects as JSON between machines. Tasks, environments, and settings travel with you.',
  },
  {
    icon: Layers,
    title: 'Environments',
    body: 'Per-project env var sets for dev, staging, or custom profiles switch without editing every task.',
  },
] as const;

const steps = [
  {
    n: '01',
    title: 'Pick a project folder',
    body: 'Point Lotaru at any directory on your machine.',
  },
  {
    n: '02',
    title: 'Define tasks',
    body: 'Shell or Docker commands with triggers and concurrency rules.',
  },
  {
    n: '03',
    title: 'Run & watch',
    body: 'Save a file, hit run, or wait for the schedule logs stream instantly.',
  },
] as const;

function FeatureCard(props: { icon: typeof Zap; title: string; body: string }): React.JSX.Element {
  const Icon = props.icon;
  return (
    <div className="rounded-2xl border border-border/70 bg-card/50 p-6 hover:border-primary/30 hover:bg-card/80 transition-colors">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary mb-4">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="text-base font-semibold mb-2">{props.title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{props.body}</p>
    </div>
  );
}

function Landing(): React.JSX.Element {
  return (
    <div className="min-h-screen relative overflow-x-hidden">
      <div className="pointer-events-none absolute inset-0 landing-glow" />
      <div className="pointer-events-none absolute inset-0 landing-grid opacity-40" />

      <SiteHeader />

      <main>
        <section className="relative max-w-6xl mx-auto px-6 pt-8 pb-20 lg:pt-12 lg:pb-28">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <h1 className="text-4xl sm:text-5xl lg:text-[3.25rem] font-bold tracking-tight leading-[1.1]">
                Task orchestration
                <span className="block text-primary">on your machine</span>
              </h1>
              <p className="mt-5 text-lg text-muted-foreground leading-relaxed max-w-xl">
                Define shell and Docker tasks on a project folder. Trigger on save, schedule, or
                manually then watch logs in the browser.
              </p>
              <div className="mt-8 max-w-md">
                <CopyCommand />
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Opens <code className="font-mono text-foreground/70">http://127.0.0.1:4317</code> ·
                data in <code className="font-mono text-foreground/70">~/.lotaru/</code>
              </p>
            </div>
            <ProductPreview className="lg:translate-y-2" />
          </div>
        </section>

        <section id="features" className="border-t border-border/60 bg-card/20">
          <div className="max-w-6xl mx-auto px-6 py-20">
            <div className="max-w-2xl mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
                Built for daily dev work
              </h2>
              <p className="mt-3 text-muted-foreground">
                A small runtime that sits beside your editor not another CI platform in the cloud.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {features.map((f) => (
                <FeatureCard key={f.title} icon={f.icon} title={f.title} body={f.body} />
              ))}
            </div>
          </div>
        </section>

        <section id="how" className="max-w-6xl mx-auto px-6 py-20">
          <div className="max-w-2xl mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">How it works</h2>
            <p className="mt-3 text-muted-foreground">Three steps from zero to running tasks.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {steps.map((s) => (
              <div
                key={s.n}
                className="relative rounded-2xl border border-border/60 bg-background/50 p-6"
              >
                <span className="text-4xl font-bold text-primary/20 font-mono">{s.n}</span>
                <h3 className="text-lg font-semibold mt-2 mb-2">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2">
              <Clock className="h-4 w-4 text-primary" />
              Cron schedules
            </span>
            <span className="inline-flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2">
              <Terminal className="h-4 w-4 text-primary" />
              Syntax-highlighted editor
            </span>
            <span className="inline-flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2">
              <Box className="h-4 w-4 text-primary" />
              Docker optional
            </span>
            <span className="inline-flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2">
              <Braces className="h-4 w-4 text-primary" />
              Project JSON import/export
            </span>
          </div>
        </section>

        <section className="border-t border-border/60">
          <div className="max-w-6xl mx-auto px-6 py-20 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Try it in one command</h2>
            <p className="mt-3 text-muted-foreground max-w-lg mx-auto">
              No install step. Ships the server and UI together.
            </p>
            <div className="mt-8 max-w-md mx-auto">
              <CopyCommand />
            </div>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'inline-flex items-center gap-2 mt-8 rounded-xl border border-border/80 px-5 py-2.5',
                'text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors',
              )}
            >
              <Github className="h-4 w-4" />
              View source on GitHub
            </a>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15 text-primary text-xs font-bold">
              L
            </span>
            Lotaru
          </span>
          <span>MIT · Node.js 20+</span>
        </div>
      </footer>
    </div>
  );
}

export function App(): React.JSX.Element {
  return <Landing />;
}
