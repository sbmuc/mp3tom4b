import ConverterTool from '@/components/ConverterTool'
import HeroSection from '@/components/HeroSection'
import HowItWorks from '@/components/HowItWorks'
import WhyMp3ToM4b from '@/components/WhyMp3ToM4b'

const softwareApplicationLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'mp3tom4b',
  description:
    'Free browser-based tool to convert MP3, M4A, WAV, FLAC, OGG, and Opus audio files into chaptered M4B audiobooks. Conversion runs entirely client-side; no files are uploaded.',
  applicationCategory: 'MultimediaApplication',
  operatingSystem: 'Any (modern web browser)',
  url: 'https://mp3tom4b.com',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'EUR',
  },
  publisher: {
    '@type': 'Organization',
    name: 'Burcevski ICT',
    url: 'https://burcevski.nl',
  },
}

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationLd) }}
      />
      <div className="mx-auto max-w-5xl px-4 py-6">
        <HeroSection />

        <ConverterTool />

        <HowItWorks />
        <WhyMp3ToM4b />
      </div>
    </>
  )
}
