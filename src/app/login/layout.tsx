export const metadata = { title: '로그인 - 대한종합상사' };

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        .top-nav, nav { display: none !important; }
        .content { padding: 0 !important; margin: 0 !important; max-width: none !important; }
        body { display: block !important; margin: 0 !important; padding: 0 !important; }
      `}</style>
      {children}
    </>
  );
}
