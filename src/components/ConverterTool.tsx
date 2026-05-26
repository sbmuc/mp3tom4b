import BitrateSelector from '@/components/BitrateSelector'
import CompatibilityNotices from '@/components/CompatibilityNotices'
import ConvertButton from '@/components/ConvertButton'
import CoverUpload from '@/components/CoverUpload'
import DownloadCard from '@/components/DownloadCard'
import DropZone from '@/components/DropZone'
import DuplicateNotice from '@/components/DuplicateNotice'
import FileList from '@/components/FileList'
import MetadataForm from '@/components/MetadataForm'
import MetadataLookup from '@/components/MetadataLookup'
import MixedAlbumWarning from '@/components/MixedAlbumWarning'
import ProgressBar from '@/components/ProgressBar'

export default function ConverterTool() {
  return (
    <div className="mt-4">
      <CompatibilityNotices />
      <DropZone />
      <DuplicateNotice />
      <MixedAlbumWarning />
      <FileList />
      <MetadataForm />
      <MetadataLookup />
      <CoverUpload />
      <BitrateSelector />
      <ConvertButton />
      <ProgressBar />
      <DownloadCard />
    </div>
  )
}
