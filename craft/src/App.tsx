import { useState, useEffect } from "react";
import { PatternNav, type Pattern } from "@/components/layout";
import {
  AuthPage,
  BlogPostFormPage,
  ChatInterfacePage,
  DataTablePage,
  LandingPage,
  MailboxPage,
  MarketplaceGridPage,
  MobilePage,
  ProductFormPage,
  SettingsPage,
} from "@/patterns";

const patterns: Pattern[] = [
  { id: "auth", label: "Auth" },
  { id: "blog-form", label: "Blog Form" },
  { id: "chat", label: "Chat Interface" },
  { id: "data-table", label: "Data Table" },
  { id: "landing", label: "Landing" },
  { id: "mailbox", label: "Mailbox" },
  { id: "marketplace", label: "Marketplace" },
  { id: "mobile", label: "Mobile" },
  { id: "product-form", label: "Product Form" },
  { id: "settings", label: "Settings" },
];

const patternComponents: Record<string, React.ComponentType> = {
  auth: AuthPage,
  "blog-form": BlogPostFormPage,
  chat: ChatInterfacePage,
  "data-table": DataTablePage,
  landing: LandingPage,
  mailbox: MailboxPage,
  marketplace: MarketplaceGridPage,
  mobile: MobilePage,
  "product-form": ProductFormPage,
  settings: SettingsPage,
};

function App() {
  const [current, setCurrent] = useState(() => {
    const hash = window.location.hash.slice(1);
    return hash || "auth";
  });

  useEffect(() => {
    window.location.hash = current;
  }, [current]);

  const Pattern = patternComponents[current];

  return (
    <div className="flex h-screen">
      <PatternNav patterns={patterns} current={current} onSelect={setCurrent} />
      <main className="flex-1 overflow-auto bg-zinc-100 p-4">
        {Pattern ? <Pattern /> : <AuthPage />}
      </main>
    </div>
  );
}

export default App;
