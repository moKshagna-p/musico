const SectionHeading = ({ title, note, action }) => (
  <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b border-white/[0.07] pb-4">
    <div className="min-w-0">
      <h2 className="font-display text-2xl leading-none text-paper tablet:text-3xl">{title}</h2>
      {note ? <p className="mt-2 text-sm text-muted">{note}</p> : null}
    </div>
    {action}
  </div>
)

export default SectionHeading
