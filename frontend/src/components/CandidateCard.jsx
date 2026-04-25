// Displays one candidate: image, name, description, current vote count.
//
// Props:
//   - candidate: { id, name, description, imageUrl, voteCount }
//   - onVote?: (candidateId: number) => Promise<void>
//   - disabled?: boolean   (already voted / not open / not authorized)

export default function CandidateCard({ candidate, onVote, disabled }) {
  // TODO(Dev B):
  //   - Render <img src={candidate.imageUrl}> with a fallback for empty/broken URLs.
  //   - Show vote count formatted as integer (BigInt coming in from ethers).
  //   - Button labelled "Vote" calls onVote(candidate.id); hide/disable per `disabled`.
  return (
    <article className="candidate-card">
      <div className="candidate-card__image-placeholder">image</div>
      <h3>{candidate?.name ?? 'TODO name'}</h3>
      <p>{candidate?.description ?? 'TODO description'}</p>
      <p>Votes: {String(candidate?.voteCount ?? 0)}</p>
      <button
        type="button"
        onClick={() => onVote?.(candidate?.id)}
        disabled={disabled}
      >
        Vote
      </button>
    </article>
  );
}
