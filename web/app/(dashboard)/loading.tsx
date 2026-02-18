import { Loader } from "../../components/ui/Loader"

export default function DashboardLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader />
    </div>
  )
}
