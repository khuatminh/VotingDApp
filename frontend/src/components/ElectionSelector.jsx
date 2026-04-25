// Dropdown of elections scoped by a `filter` predicate.
// Spec §5.2–§5.4. Skeleton: does not yet fetch from chain.
//
// Props:
//   - value: number | null          (selected electionId)
//   - onChange: (id: number) => void
//   - filter?: (e: ElectionSummary) => boolean   (defaults to "all")
//
// ElectionSummary shape: { id, name, state }

export default function ElectionSelector({ value, onChange, filter }) {
  // TODO(Dev B):
  //   - Use useContract().election to:
  //       * read electionCount
  //       * for each id, call getElection(id) → push into list
  //       * cache via useEffect on (election address, chainId)
  //   - Apply `filter` if provided.
  //   - Render <select>.
  //   - Handle loading / empty states.
  value; onChange; filter;
  return (
    <select disabled>
      <option>TODO: load elections</option>
    </select>
  );
}
