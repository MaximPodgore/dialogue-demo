import TrackedQuill from "../components/TrackedQuill";

export default function Home() {
  return (
    <main className="p-6 bg-pageBg">
      <div className="flex flex-col md:flex-row gap-6 min-h-[60vh] items-stretch">
        <section className="w-full md:w-1/2 bg-placeholder p-6 rounded-md shadow-sm flex flex-col">
          <h2 className="text-lg font-semibold mb-4 text-primary">Form</h2>
          <form className="space-y-4">
            <div>
              <label className="block mb-1 text-muted">Input</label>
              <input className="w-full border border-border rounded px-3 py-2" name="single" type="text" />
            </div>
            <div>
              <button type="submit" className="px-4 py-2 bg-primary text-white rounded">
                Send
              </button>
            </div>
          </form>
        </section>
        <section className="w-full md:w-1/2 bg-card p-6 rounded-md shadow-sm flex flex-col">
          <h2 className="text-lg font-semibold mb-4 text-primary">Editable</h2>
          <div className="w-full h-full min-h-[300px] flex-1">
            {/* TrackedQuill is a client component that shows insert/delete highlights */}
            <TrackedQuill initial={"Start typing here..."} />
          </div>
        </section>
      </div>
    </main>
  );
}

