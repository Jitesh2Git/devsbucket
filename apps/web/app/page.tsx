import { Button } from "@/components/ui/button";

const HomePage = () => {
  return (
    <section className="mx-auto flex max-w-6xl flex-col items-start gap-4 px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">DevsBucket</h1>
      <p className="max-w-prose text-muted-foreground">
        A developer-focused file drive: upload, organize, share and edit files live together.
      </p>
      <Button>Get started</Button>
    </section>
  );
};

export default HomePage;
