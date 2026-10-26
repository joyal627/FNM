import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FNM - AI Instagram Reel Cloning & 3D Spatial Inpainting',
  description: 'Clone any Instagram Reel and seamlessly replace the subject with yours in 3D perspective with original audio sync.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased selection:bg-white selection:text-black">
        {children}
      </body>
    </html>
  );
}
