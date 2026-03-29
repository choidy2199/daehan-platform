export const metadata = { title: '로그인 - 대한종합상사' };

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        .top-nav, nav, .content { display: none !important; }
        body { display: block !important; }
      `}</style>
      {children}
    </>
  );
}
