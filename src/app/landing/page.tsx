import { TopNav } from "./components/TopNav";
import { Hero } from "./components/Hero";
import { FeatureCards } from "./components/FeatureCards";
import { CTA } from "./components/CTA";
import { Footer } from "./components/Footer";

export default function LandingPage() {
  return (
    <>
      <TopNav />
      <main>
        <Hero />
        <FeatureCards />
        <CTA />
      </main>
      <Footer />
    </>
  );
}
