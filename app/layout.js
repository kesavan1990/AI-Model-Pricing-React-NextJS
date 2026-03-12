import '../css/styles.css';
import { PricingProvider } from '../context/PricingContext';
import { ThemeInit } from '../components/ThemeInit';

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
        <ThemeInit />
        <PricingProvider>{children}</PricingProvider>
      </body>
    </html>
  );
}
