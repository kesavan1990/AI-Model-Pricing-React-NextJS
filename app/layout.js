import './tailwind.css';
import '../css/styles.css';
import Script from 'next/script';
import { ThemeProvider } from '../context/ThemeContext';
import { PricingProvider } from '../context/PricingContext';
import { ThemeInit } from '../components/ThemeInit';
import { NavigationProgress } from '../components/NavigationProgress';

export const metadata = {
  title: 'AI Model Pricing - Gemini, OpenAI, Anthropic, Mistral',
  description: 'AI Model Pricing Intelligence Dashboard',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          rel="icon"
          href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><text y='.9em' font-size='24'>🤖</text></svg>"
          type="image/svg+xml"
        />
      </head>
      <body>
        <Script
          src="https://unpkg.com/gpt-tokenizer/dist/cl100k_base.js"
          strategy="lazyOnload"
          crossOrigin="anonymous"
        />
        <ThemeInit />
        <NavigationProgress />
        <ThemeProvider>
          <PricingProvider>{children}</PricingProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
