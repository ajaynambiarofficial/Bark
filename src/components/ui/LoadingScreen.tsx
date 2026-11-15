import { BarkLogo } from "../brand/BarkLogo";

export function LoadingScreen() {
  return (
    <main className="grid min-h-dvh place-items-center bg-app" aria-busy="true" aria-label="Loading Bark">
      <div className="flex flex-col items-center gap-5">
        <BarkLogo />
        <span className="h-1 w-28 overflow-hidden rounded-full bg-brand-soft">
          <span className="block h-full w-1/2 animate-[loading_1.1s_ease-in-out_infinite] rounded-full bg-brand motion-reduce:animate-none" />
        </span>
        <span className="sr-only">Restoring your session</span>
      </div>
    </main>
  );
}
