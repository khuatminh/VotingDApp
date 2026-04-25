// Admin dashboard: elections, voters (per-election), admin-role management.
// Spec §5.2. Three sections on one page; each is a TODO skeleton.
import { useContract } from '../hooks/useContract.js';

export default function AdminPage() {
  const { isAdmin, ready } = useContract();

  if (!ready) return <p>Connect a wallet to continue.</p>;
  if (!isAdmin) return <p>Your account does not hold ADMIN_ROLE.</p>;

  return (
    <div className="admin-page">
      <section>
        <h2>Elections</h2>
        {/* TODO(Dev A):
            - List of all elections (use ElectionSelector's data source or a dedicated list).
            - "Create election" form (name, description) → election.createElection(...)
            - Per-row actions: "Add candidate" (opens form: name, description, imageUrl),
              "Start", "End". Gate by state.
        */}
        <p>TODO: elections list + create form + per-row actions</p>
      </section>

      <section>
        <h2>Voters</h2>
        {/* TODO(Dev A):
            - ElectionSelector to pick target election.
            - Address input + "Authorize" / "Revoke" buttons → voterRegistry.authorize/revoke.
            - Batch authorize: textarea of newline-separated addresses → authorizeVoters.
        */}
        <p>TODO: voter authorization UI</p>
      </section>

      <section>
        <h2>Admin roles</h2>
        {/* TODO(Dev A):
            - List of current ADMIN_ROLE holders, derived from RoleGranted/RoleRevoked events
              on BOTH voterRegistry and election (queryFilter(fromBlock=0)).
              Source of truth = intersection of both contracts (spec §3.4).
            - Grant/revoke form: address input; fires grantRole/revokeRole on BOTH contracts
              sequentially; shows per-tx status.
        */}
        <p>TODO: admin-role list + grant/revoke</p>
      </section>
    </div>
  );
}
