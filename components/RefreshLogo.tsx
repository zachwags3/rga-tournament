'use client'

import Image from 'next/image'

export default function RefreshLogo() {
  return (
    <button
      onClick={() => window.location.reload()}
      title="Tap to refresh"
      className="active:scale-90 transition-transform duration-100"
    >
      <Image
        src="/rga-logo.png"
        alt="RGA Logo — tap to refresh"
        width={52}
        height={52}
        className="drop-shadow-md"
      />
    </button>
  )
}
