import BitrateSelector from '@/components/BitrateSelector'
import ConvertButton from '@/components/ConvertButton'
import CoverUpload from '@/components/CoverUpload'
import DownloadCard from '@/components/DownloadCard'
import DropZone from '@/components/DropZone'
import DuplicateNotice from '@/components/DuplicateNotice'
import FileList from '@/components/FileList'
import HeroSection from '@/components/HeroSection'
import HowItWorks from '@/components/HowItWorks'
import MetadataForm from '@/components/MetadataForm'
import PrivacyBadge from '@/components/PrivacyBadge'
import ProgressBar from '@/components/ProgressBar'
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

        <div className="mt-4">
          <DropZone />
          <div className="mt-3 flex justify-center">
            <PrivacyBadge />
          </div>
          <DuplicateNotice />
          <FileList />
          <MetadataForm />
          <CoverUpload />
          <BitrateSelector />
          <ConvertButton />
          <ProgressBar />
          <DownloadCard />
        </div>

        <HowItWorks />
        <WhyMp3ToM4b />
      </div>
    </>
  )
}
