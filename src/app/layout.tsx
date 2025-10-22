import '@/styles/globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Providers } from '@/components/Providers'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Live Class - Interactive Real-time Learning Platform',
  description: 'A comprehensive online education system featuring live sessions, real-time collaboration, screen sharing, materials management, YouTube integration, and interactive assessments. Built with Next.js, Socket.IO, and WebRTC.',
  keywords: ['online learning', 'live classroom', 'education platform', 'screen sharing', 'real-time chat', 'quiz system', 'materials management'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
