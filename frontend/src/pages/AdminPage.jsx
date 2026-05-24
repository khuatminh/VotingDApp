import { useEffect, useRef, useState } from 'react';
import { useContract } from '../hooks/useContract.js';
import ImageUploader from '../components/ImageUploader.jsx';

const STATE_LABELS = ['NotStarted', 'Open', 'Ended'];
function stateLabel(s) { return STATE_LABELS[Number(s)] ?? 'NotStarted'; }

const STATE_LABELS_VI = {
  NotStarted: 'Chưa bắt đầu',
  Open:       'Đang mở',
  Ended:      'Đã kết thúc',
};

function StateBadge({ state }) {
  const cls =
    state === 'Open'   ? 'badge-open' :
    state === 'Ended'  ? 'badge-ended' : 'badge-notstarted';
  return (
    <span className={`badge ${cls}`}>
      <span className="dot"></span>
      {STATE_LABELS_VI[state] ?? state}
    </span>
  );
}

export default function AdminPage({ pushToast, setPendingTx }) {
  const { voterRegistry, election, isAdmin, ready } = useContract();
  const [tab, setTab]               = useState('elections');
  const [elections, setElections]   = useState([]);
  const [candidates, setCandidates] = useState({});
  const [admins, setAdmins]         = useState([]);
  const [voters, setVoters]         = useState({});
  const [loading, setLoading]       = useState(true);
  const adminRoleRef = useRef(null);

  useEffect(() => {
    if (!ready) return;
    setLoading(true);
    Promise.all([loadElections(), loadAdmins()]).finally(() => setLoading(false));
  }, [ready]);

  async function loadElections() {
    const count = Number(await election.electionCount());
    if (count === 0) { setElections([]); return; }
    const list = await Promise.all(
      Array.from({ length: count }, (_, i) => election.getElection(i))
    );
    setElections(list
      .filter(e => !e.deleted)
      .map(e => ({
        id:             Number(e.id),
        name:           e.name,
        description:    e.description,
        thumbnailUrl:   e.thumbnailUrl,
        creator:        e.creator,
        state:          stateLabel(e.state),
        candidateCount: Number(e.candidateCount),
      })));
  }

  async function loadAdmins() {
    const ADMIN_ROLE = await voterRegistry.ADMIN_ROLE();
    adminRoleRef.current = ADMIN_ROLE;

    const [vrGranted, vrRevoked, elGranted, elRevoked] = await Promise.all([
      voterRegistry.queryFilter(voterRegistry.filters.RoleGranted(ADMIN_ROLE), 0),
      voterRegistry.queryFilter(voterRegistry.filters.RoleRevoked(ADMIN_ROLE), 0),
      election.queryFilter(election.filters.RoleGranted(ADMIN_ROLE), 0),
      election.queryFilter(election.filters.RoleRevoked(ADMIN_ROLE), 0),
    ]);

    function buildSet(granted, revoked) {
      const s = new Set(granted.map(l => l.args[1].toLowerCase()));
      revoked.forEach(l => s.delete(l.args[1].toLowerCase()));
      return s;
    }
    const vrSet = buildSet(vrGranted, vrRevoked);
    const elSet = buildSet(elGranted, elRevoked);
    const both  = [...vrSet].filter(a => elSet.has(a));

    setAdmins(both.map(addr => ({ addr, grantedAt: '—', grantedBy: '—' })));
  }

  async function loadCandidates(electionId) {
    const results = await election.getResults(electionId);
    setCandidates(prev => ({
      ...prev,
      [electionId]: results.map(c => ({
        id:          Number(c.id),
        name:        c.name,
        slogan:      c.slogan,
        description: c.description,
        bio:         c.bio,
        imageUrl:    c.imageUrl,
        voteCount:   Number(c.voteCount),
      })),
    }));
  }

  async function loadVoters(electionId) {
    const eid = BigInt(electionId);
    const [authorized, revoked] = await Promise.all([
      voterRegistry.queryFilter(voterRegistry.filters.VoterAuthorized(eid), 0),
      voterRegistry.queryFilter(voterRegistry.filters.VoterRevoked(eid), 0),
    ]);
    const s = new Set(authorized.map(l => l.args[1].toLowerCase()));
    revoked.forEach(l => s.delete(l.args[1].toLowerCase()));
    setVoters(prev => ({ ...prev, [electionId]: [...s] }));
  }

  if (!ready)   return <NotReady msg="Vui lòng kết nối ví để tiếp tục." />;
  if (!isAdmin) return <NotReady msg="Tài khoản của bạn không có quyền ADMIN_ROLE." />;
  if (loading)  return <NotReady msg="Đang tải…" />;

  return (
    <div className="page">
      <div className="container admin-page">
        <div className="eyebrow mb-16">Trang quản trị</div>
        <h1 style={{ fontWeight: 600, fontSize: 32, letterSpacing: '-.02em', marginBottom: 0 }}>
          <em style={{ fontStyle: 'italic', color: 'var(--accent)' }}>Quản trị</em>
        </h1>

        <div className="subtabs">
          <button className={`subtab${tab === 'elections' ? ' active' : ''}`}
            onClick={() => setTab('elections')}>
            Cuộc bầu cử <span className="num">{elections.length}</span>
          </button>
          <button className={`subtab${tab === 'voters' ? ' active' : ''}`}
            onClick={() => setTab('voters')}>
            Cử tri
          </button>
          <button className={`subtab${tab === 'admins' ? ' active' : ''}`}
            onClick={() => setTab('admins')}>
            Quản trị viên <span className="num">{admins.length}</span>
          </button>
        </div>

        {tab === 'elections' && (
          <ElectionsTab
            elections={elections} setElections={setElections}
            candidates={candidates} setCandidates={setCandidates}
            loadCandidates={loadCandidates}
            election={election}
            pushToast={pushToast} setPendingTx={setPendingTx}
          />
        )}
        {tab === 'voters' && (
          <VotersTab
            elections={elections}
            voters={voters} setVoters={setVoters}
            voterRegistry={voterRegistry}
            loadVoters={loadVoters}
            pushToast={pushToast} setPendingTx={setPendingTx}
          />
        )}
        {tab === 'admins' && (
          <AdminsTab
            admins={admins} setAdmins={setAdmins}
            voterRegistry={voterRegistry} election={election}
            adminRoleRef={adminRoleRef}
            pushToast={pushToast} setPendingTx={setPendingTx}
          />
        )}
      </div>
    </div>
  );
}

function NotReady({ msg }) {
  return (
    <div className="page">
      <div className="container admin-page">
        <p style={{ color: 'var(--ink-3)' }}>{msg}</p>
      </div>
    </div>
  );
}

function ElectionsTab({
  elections, setElections,
  candidates, setCandidates, loadCandidates,
  election,
  pushToast, setPendingTx,
}) {
  // Create election
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName]             = useState('');
  const [desc, setDesc]             = useState('');
  const [thumbUrl, setThumbUrl]     = useState('');
  const [creating, setCreating]     = useState(false);

  // Add candidate
  const [addCandFor, setAddCandFor] = useState(null);
  const [cName, setCName]           = useState('');
  const [cSlogan, setCSlogan]       = useState('');
  const [cDesc, setCDesc]           = useState('');
  const [cBio, setCBio]             = useState('');
  const [cImg, setCImg]             = useState('');
  const [addingCand, setAddingCand] = useState(false);

  // Lifecycle
  const [starting, setStarting]     = useState(null);
  const [ending, setEnding]         = useState(null);

  // Edit election
  const [editId, setEditId]            = useState(null);
  const [editName, setEditName]        = useState('');
  const [editDesc, setEditDesc]        = useState('');
  const [editThumbUrl, setEditThumbUrl] = useState('');
  const [updating, setUpdating]        = useState(null);

  // Delete election
  const [deleting, setDeleting]     = useState(null);

  // Expand candidates panel
  const [expandedId, setExpandedId] = useState(null);

  // Edit candidate — key is `${electionId}-${candidateId}`
  const [editCandKey, setEditCandKey]   = useState(null);
  const [ecName, setEcName]             = useState('');
  const [ecSlogan, setEcSlogan]         = useState('');
  const [ecDesc, setEcDesc]             = useState('');
  const [ecBio, setEcBio]               = useState('');
  const [ecImg, setEcImg]               = useState('');
  const [updatingCand, setUpdatingCand] = useState(null);

  // Delete candidate
  const [deletingCand, setDeletingCand] = useState(null);

  function openEdit(e) {
    setEditId(e.id);
    setEditName(e.name);
    setEditDesc(e.description);
    setEditThumbUrl(e.thumbnailUrl ?? '');
    setAddCandFor(null);
  }

  function openEditCand(eid, c) {
    setEditCandKey(`${eid}-${c.id}`);
    setEcName(c.name);
    setEcSlogan(c.slogan ?? '');
    setEcDesc(c.description);
    setEcBio(c.bio ?? '');
    setEcImg(c.imageUrl);
  }

  async function handleToggleExpand(eid) {
    if (expandedId === eid) { setExpandedId(null); return; }
    setExpandedId(eid);
    if (!candidates[eid]) await loadCandidates(eid);
  }

  async function handleCreate() {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const tx = await election.createElection(name.trim(), desc.trim(), thumbUrl);
      setPendingTx({ label: `Đang tạo "${name.trim()}"…`, hash: tx.hash });
      await tx.wait();
      setElections(prev => [...prev, {
        id: prev.length,
        name: name.trim(), description: desc.trim(),
        thumbnailUrl: thumbUrl,
        state: 'NotStarted', candidateCount: 0,
      }]);
      pushToast('Đã tạo cuộc bầu cử', 'success');
      setName(''); setDesc(''); setThumbUrl(''); setShowCreate(false);
    } catch (e) { pushToast(e.reason ?? e.message, 'error'); }
    finally { setCreating(false); setPendingTx(null); }
  }

  async function handleUpdate(electionId) {
    if (!editName.trim()) return;
    setUpdating(electionId);
    try {
      const tx = await election.updateElection(
        electionId,
        editName.trim(),
        editDesc.trim(),
        editThumbUrl
      );
      setPendingTx({ label: 'Đang cập nhật cuộc bầu cử…', hash: tx.hash });
      await tx.wait();
      setElections(prev => prev.map(e =>
        e.id === electionId
          ? { ...e, name: editName.trim(), description: editDesc.trim(), thumbnailUrl: editThumbUrl }
          : e
      ));
      pushToast('Đã cập nhật cuộc bầu cử', 'success');
      setEditId(null);
    } catch (e) { pushToast(e.reason ?? e.message, 'error'); }
    finally { setUpdating(null); setPendingTx(null); }
  }

  async function handleDelete(electionId) {
    setDeleting(electionId);
    try {
      const tx = await election.deleteElection(electionId);
      setPendingTx({ label: 'Đang xoá cuộc bầu cử…', hash: tx.hash });
      await tx.wait();
      setElections(prev => prev.filter(e => e.id !== electionId));
      if (expandedId === electionId) setExpandedId(null);
      pushToast('Đã xoá cuộc bầu cử', 'success');
    } catch (e) { pushToast(e.reason ?? e.message, 'error'); }
    finally { setDeleting(null); setPendingTx(null); }
  }

  async function handleAddCandidate(electionId) {
    if (!cName.trim()) return;
    setAddingCand(true);
    try {
      const tx = await election.addCandidate(
        electionId,
        cName.trim(),
        cSlogan.trim(),
        cDesc.trim(),
        cBio.trim(),
        cImg
      );
      setPendingTx({ label: `Đang thêm "${cName.trim()}"…`, hash: tx.hash });
      await tx.wait();
      setElections(prev => prev.map(e =>
        e.id === electionId ? { ...e, candidateCount: e.candidateCount + 1 } : e
      ));
      setCandidates(prev => {
        if (!prev[electionId]) return prev;
        const newCand = {
          id: prev[electionId].length,
          name: cName.trim(),
          slogan: cSlogan.trim(),
          description: cDesc.trim(),
          bio: cBio.trim(),
          imageUrl: cImg,
          voteCount: 0,
        };
        return { ...prev, [electionId]: [...prev[electionId], newCand] };
      });
      pushToast('Đã thêm ứng viên', 'success');
      setCName(''); setCSlogan(''); setCDesc(''); setCBio(''); setCImg('');
      setAddCandFor(null);
    } catch (e) { pushToast(e.reason ?? e.message, 'error'); }
    finally { setAddingCand(false); setPendingTx(null); }
  }

  async function handleUpdateCandidate(electionId, candidateId) {
    if (!ecName.trim()) return;
    const key = `${electionId}-${candidateId}`;
    setUpdatingCand(key);
    try {
      const tx = await election.updateCandidate(
        electionId, candidateId,
        ecName.trim(), ecSlogan.trim(), ecDesc.trim(), ecBio.trim(), ecImg
      );
      setPendingTx({ label: 'Đang cập nhật ứng viên…', hash: tx.hash });
      await tx.wait();
      setCandidates(prev => ({
        ...prev,
        [electionId]: (prev[electionId] ?? []).map(c =>
          c.id === candidateId
            ? {
                ...c,
                name: ecName.trim(),
                slogan: ecSlogan.trim(),
                description: ecDesc.trim(),
                bio: ecBio.trim(),
                imageUrl: ecImg,
              }
            : c
        ),
      }));
      pushToast('Đã cập nhật ứng viên', 'success');
      setEditCandKey(null);
    } catch (e) { pushToast(e.reason ?? e.message, 'error'); }
    finally { setUpdatingCand(null); setPendingTx(null); }
  }

  async function handleDeleteCandidate(electionId, candidateId) {
    const key = `${electionId}-${candidateId}`;
    setDeletingCand(key);
    try {
      const tx = await election.deleteCandidate(electionId, candidateId);
      setPendingTx({ label: 'Đang xoá ứng viên…', hash: tx.hash });
      await tx.wait();
      // swap-and-pop changes IDs, so reload from chain
      await loadCandidates(electionId);
      setElections(prev => prev.map(e =>
        e.id === electionId ? { ...e, candidateCount: e.candidateCount - 1 } : e
      ));
      pushToast('Đã xoá ứng viên', 'success');
    } catch (e) { pushToast(e.reason ?? e.message, 'error'); }
    finally { setDeletingCand(null); setPendingTx(null); }
  }

  async function handleStart(electionId) {
    setStarting(electionId);
    try {
      const tx = await election.startElection(electionId);
      setPendingTx({ label: 'Đang mở cổng bỏ phiếu…', hash: tx.hash });
      await tx.wait();
      setElections(prev => prev.map(e => e.id === electionId ? { ...e, state: 'Open' } : e));
      pushToast('Đã mở cuộc bầu cử', 'success');
    } catch (e) { pushToast(e.reason ?? e.message, 'error'); }
    finally { setStarting(null); setPendingTx(null); }
  }

  async function handleEnd(electionId) {
    setEnding(electionId);
    try {
      const tx = await election.endElection(electionId);
      setPendingTx({ label: 'Đang đóng cuộc bầu cử…', hash: tx.hash });
      await tx.wait();
      setElections(prev => prev.map(e => e.id === electionId ? { ...e, state: 'Ended' } : e));
      pushToast('Đã kết thúc cuộc bầu cử', 'success');
    } catch (e) { pushToast(e.reason ?? e.message, 'error'); }
    finally { setEnding(null); setPendingTx(null); }
  }

  return (
    <>
      <div className="row-h gap-12" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
        <div className="eyebrow">Tất cả cuộc bầu cử</div>
        <button className="btn btn-primary" onClick={() => setShowCreate(s => !s)}>
          {showCreate ? 'Huỷ' : '+ Tạo cuộc bầu cử'}
        </button>
      </div>

      {showCreate && (
        <div className="form-card mb-24">
          <div className="grid-2">
            <div className="field">
              <label>Tên cuộc bầu cử</label>
              <input className="input" value={name} onChange={e => setName(e.target.value)}
                placeholder="Tên cuộc bầu cử" />
            </div>
            <div className="field">
              <label>Mô tả</label>
              <input className="input" value={desc} onChange={e => setDesc(e.target.value)}
                placeholder="Mô tả ngắn" />
            </div>
          </div>
          <div className="field" style={{ marginTop: 12 }}>
            <ImageUploader label="Ảnh đại diện" value={thumbUrl} onChange={setThumbUrl} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <button className="btn" onClick={() => setShowCreate(false)}>Huỷ</button>
            <button className="btn btn-accent" onClick={handleCreate}
              disabled={!name.trim() || creating}>
              {creating ? 'Đang tạo…' : 'Tạo cuộc bầu cử'}
            </button>
          </div>
        </div>
      )}

      <div className="col gap-16">
        {elections.length === 0 && (
          <p style={{ color: 'var(--ink-3)', fontSize: 13 }}>Chưa có cuộc bầu cử nào.</p>
        )}
        {elections.map(e => (
          <div key={e.id}>
            {/* Main row */}
            <div className="row-card">
              <div className="meta">
                <div className="row-h gap-12" style={{ flexWrap: 'wrap' }}>
                  <span className="title">{e.name}</span>
                  <StateBadge state={e.state} />
                </div>
                <div className="sub">
                  #{String(e.id).padStart(3, '0')} &middot;{' '}
                  {e.candidateCount} ứng viên
                  {e.description && <> &middot; {e.description}</>}
                </div>
              </div>
              <div className="actions">
                <button className="btn btn-sm"
                  onClick={() => handleToggleExpand(e.id)}>
                  {expandedId === e.id ? '▲ Ẩn' : '▼ Ứng viên'}
                </button>
                <button className="btn btn-sm"
                  onClick={() => editId === e.id ? setEditId(null) : openEdit(e)}>
                  {editId === e.id ? 'Huỷ' : 'Sửa'}
                </button>
                {e.state === 'NotStarted' && (
                  <button className="btn btn-sm btn-danger"
                    disabled={deleting === e.id}
                    onClick={() => handleDelete(e.id)}>
                    {deleting === e.id ? 'Đang xoá…' : 'Xoá'}
                  </button>
                )}
                {e.state === 'NotStarted' && (<>
                  <button className="btn btn-sm"
                    onClick={() => setAddCandFor(addCandFor === e.id ? null : e.id)}>
                    + Ứng viên
                  </button>
                  <button className="btn btn-sm btn-primary"
                    disabled={e.candidateCount < 2 || starting === e.id}
                    onClick={() => handleStart(e.id)}>
                    {starting === e.id ? 'Đang mở…' : 'Mở bỏ phiếu'}
                  </button>
                </>)}
                {e.state === 'Open' && (
                  <button className="btn btn-sm btn-danger"
                    disabled={ending === e.id}
                    onClick={() => handleEnd(e.id)}>
                    {ending === e.id ? 'Đang đóng…' : 'Kết thúc bầu cử'}
                  </button>
                )}
              </div>
            </div>

            {/* Edit election form */}
            {editId === e.id && (
              <div className="form-card" style={{ marginTop: 8 }}>
                <div className="eyebrow mb-12">Chỉnh sửa cuộc bầu cử</div>
                <div className="grid-2">
                  <div className="field">
                    <label>Tên cuộc bầu cử</label>
                    <input className="input" value={editName}
                      onChange={ev => setEditName(ev.target.value)} />
                  </div>
                  <div className="field">
                    <label>Mô tả</label>
                    <input className="input" value={editDesc}
                      onChange={ev => setEditDesc(ev.target.value)} />
                  </div>
                </div>
                <div className="field" style={{ marginTop: 12 }}>
                  <ImageUploader label="Ảnh đại diện" value={editThumbUrl} onChange={setEditThumbUrl} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                  <button className="btn btn-sm" onClick={() => setEditId(null)}>Huỷ</button>
                  <button className="btn btn-sm btn-accent"
                    disabled={!editName.trim() || updating === e.id}
                    onClick={() => handleUpdate(e.id)}>
                    {updating === e.id ? 'Đang lưu…' : 'Lưu'}
                  </button>
                </div>
              </div>
            )}

            {/* Add candidate form */}
            {addCandFor === e.id && (
              <div className="form-card" style={{ marginTop: 8 }}>
                <div className="eyebrow mb-12">Thêm ứng viên</div>
                <div className="grid-2">
                  <div className="field">
                    <label>Họ tên</label>
                    <input className="input" value={cName} onChange={ev => setCName(ev.target.value)}
                      placeholder="Họ và tên đầy đủ" />
                  </div>
                  <div className="field">
                    <label>Khẩu hiệu</label>
                    <input className="input" value={cSlogan} onChange={ev => setCSlogan(ev.target.value)}
                      placeholder="Khẩu hiệu tranh cử (~60 ký tự)" />
                  </div>
                </div>
                <div className="grid-2" style={{ marginTop: 12 }}>
                  <div className="field">
                    <label>Mô tả</label>
                    <input className="input" value={cDesc} onChange={ev => setCDesc(ev.target.value)}
                      placeholder="Mô tả ngắn" />
                  </div>
                  <div className="field">
                    <ImageUploader label="Ảnh chân dung" value={cImg} onChange={setCImg} />
                  </div>
                </div>
                <div className="field" style={{ marginTop: 12 }}>
                  <label>Tiểu sử</label>
                  <textarea className="textarea" rows={6} value={cBio}
                    onChange={ev => setCBio(ev.target.value)}
                    placeholder="Tiểu sử chi tiết. Giữ nguyên dấu xuống dòng." />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                  <button className="btn btn-sm" onClick={() => setAddCandFor(null)}>Huỷ</button>
                  <button className="btn btn-sm btn-accent"
                    disabled={!cName.trim() || addingCand}
                    onClick={() => handleAddCandidate(e.id)}>
                    {addingCand ? 'Đang thêm…' : 'Thêm ứng viên'}
                  </button>
                </div>
              </div>
            )}

            {/* Candidates panel */}
            {expandedId === e.id && (
              <div className="form-card" style={{ marginTop: 8, padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--line)' }}>
                  <div className="eyebrow">Danh sách ứng viên</div>
                </div>
                {!candidates[e.id] ? (
                  <div style={{ padding: '16px 20px', color: 'var(--ink-3)', fontSize: 13 }}>Đang tải…</div>
                ) : candidates[e.id].length === 0 ? (
                  <div style={{ padding: '16px 20px', color: 'var(--ink-3)', fontSize: 13 }}>Chưa có ứng viên nào.</div>
                ) : (
                  <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {candidates[e.id].map(c => (
                      <div key={c.id}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                          <div>
                            <span style={{ fontWeight: 600 }}>{c.name}</span>
                            {c.description && (
                              <span style={{ color: 'var(--ink-3)', marginLeft: 10, fontSize: 13 }}>{c.description}</span>
                            )}
                            {(e.state === 'Open' || e.state === 'Ended') && (
                              <span style={{ marginLeft: 10, fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>
                                {c.voteCount} phiếu
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                            <button className="btn btn-sm"
                              onClick={() =>
                                editCandKey === `${e.id}-${c.id}`
                                  ? setEditCandKey(null)
                                  : openEditCand(e.id, c)
                              }>
                              {editCandKey === `${e.id}-${c.id}` ? 'Huỷ' : 'Sửa'}
                            </button>
                            {e.state === 'NotStarted' && (
                              <button className="btn btn-sm btn-danger"
                                disabled={deletingCand === `${e.id}-${c.id}`}
                                onClick={() => handleDeleteCandidate(e.id, c.id)}>
                                {deletingCand === `${e.id}-${c.id}` ? 'Đang xoá…' : 'Xoá'}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Edit candidate form */}
                        {editCandKey === `${e.id}-${c.id}` && (
                          <div className="form-card" style={{ marginTop: 8 }}>
                            <div className="grid-2">
                              <div className="field">
                                <label>Họ tên</label>
                                <input className="input" value={ecName}
                                  onChange={ev => setEcName(ev.target.value)} />
                              </div>
                              <div className="field">
                                <label>Khẩu hiệu</label>
                                <input className="input" value={ecSlogan}
                                  onChange={ev => setEcSlogan(ev.target.value)} />
                              </div>
                            </div>
                            <div className="grid-2" style={{ marginTop: 12 }}>
                              <div className="field">
                                <label>Mô tả</label>
                                <input className="input" value={ecDesc}
                                  onChange={ev => setEcDesc(ev.target.value)} />
                              </div>
                              <div className="field">
                                <ImageUploader label="Ảnh chân dung" value={ecImg} onChange={setEcImg} />
                              </div>
                            </div>
                            <div className="field" style={{ marginTop: 12 }}>
                              <label>Tiểu sử</label>
                              <textarea className="textarea" rows={6} value={ecBio}
                                onChange={ev => setEcBio(ev.target.value)} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                              <button className="btn btn-sm" onClick={() => setEditCandKey(null)}>Huỷ</button>
                              <button className="btn btn-sm btn-accent"
                                disabled={!ecName.trim() || updatingCand === `${e.id}-${c.id}`}
                                onClick={() => handleUpdateCandidate(e.id, c.id)}>
                                {updatingCand === `${e.id}-${c.id}` ? 'Đang lưu…' : 'Lưu'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

function VotersTab({ elections, voters, setVoters, voterRegistry, loadVoters, pushToast, setPendingTx }) {
  const [pickedId, setPickedId]       = useState(elections[0]?.id ?? null);
  const [single, setSingle]           = useState('');
  const [batch, setBatch]             = useState('');
  const [authorizing, setAuthorizing] = useState(false);
  const [revoking, setRevoking]       = useState(null);
  const [batchAuth, setBatchAuth]     = useState(false);

  useEffect(() => {
    if (pickedId !== null && !voters[pickedId]) loadVoters(pickedId);
  }, [pickedId]);

  const list = voters[pickedId] ?? [];

  async function handleAuthorize() {
    if (!single.startsWith('0x') || pickedId === null) return;
    setAuthorizing(true);
    try {
      const tx = await voterRegistry.authorizeVoter(pickedId, single);
      setPendingTx({ label: `Đang cấp quyền cho ${single.slice(0, 10)}…`, hash: tx.hash });
      await tx.wait();
      setVoters(prev => ({ ...prev, [pickedId]: [...(prev[pickedId] ?? []), single.toLowerCase()] }));
      pushToast('Đã cấp quyền cho cử tri', 'success');
      setSingle('');
    } catch (e) { pushToast(e.reason ?? e.message, 'error'); }
    finally { setAuthorizing(false); setPendingTx(null); }
  }

  async function handleRevoke(addr) {
    if (pickedId === null) return;
    setRevoking(addr);
    try {
      const tx = await voterRegistry.revokeVoter(pickedId, addr);
      setPendingTx({ label: `Đang thu hồi quyền ${addr.slice(0, 10)}…`, hash: tx.hash });
      await tx.wait();
      setVoters(prev => ({
        ...prev,
        [pickedId]: (prev[pickedId] ?? []).filter(a => a !== addr.toLowerCase()),
      }));
      pushToast('Đã thu hồi quyền cử tri', 'success');
    } catch (e) { pushToast(e.reason ?? e.message, 'error'); }
    finally { setRevoking(null); setPendingTx(null); }
  }

  async function handleBatchAuthorize() {
    if (pickedId === null) return;
    const addrs = batch.split(/[\s,]+/).filter(a => a.startsWith('0x') && a.length >= 10);
    if (!addrs.length) return;
    setBatchAuth(true);
    try {
      const tx = await voterRegistry.authorizeVoters(pickedId, addrs);
      setPendingTx({ label: `Đang cấp quyền cho ${addrs.length} cử tri…`, hash: tx.hash });
      await tx.wait();
      setVoters(prev => ({
        ...prev,
        [pickedId]: [...new Set([...(prev[pickedId] ?? []), ...addrs.map(a => a.toLowerCase())])],
      }));
      pushToast(`Đã cấp quyền cho ${addrs.length} cử tri`, 'success');
      setBatch('');
    } catch (e) { pushToast(e.reason ?? e.message, 'error'); }
    finally { setBatchAuth(false); setPendingTx(null); }
  }

  return (
    <>
      <div className="eyebrow mb-16">Cấp quyền theo từng cuộc bầu cử</div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 24 }}>
        {elections.map(e => (
          <button key={e.id}
            className={`chip${e.id === pickedId ? ' active' : ''}`}
            style={{ height: 40, padding: '0 18px' }}
            onClick={() => setPickedId(e.id)}>
            {e.name.length > 36 ? e.name.slice(0, 34) + '…' : e.name}
            <span className="count">{(voters[e.id] ?? []).length}</span>
          </button>
        ))}
        {elections.length === 0 && (
          <p style={{ color: 'var(--ink-3)', fontSize: 13 }}>Chưa có cuộc bầu cử nào.</p>
        )}
      </div>

      {pickedId !== null && (
        <>
          <div className="grid-2 mb-24">
            <div className="form-card">
              <div className="eyebrow mb-16">Cấp quyền đơn lẻ</div>
              <div className="field">
                <label>Địa chỉ ví</label>
                <input className="input" value={single}
                  onChange={e => setSingle(e.target.value)} placeholder="0x…" />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                <button className="btn btn-sm btn-accent"
                  disabled={!single.startsWith('0x') || authorizing}
                  onClick={handleAuthorize}>
                  {authorizing ? 'Đang cấp quyền…' : 'Cấp quyền'}
                </button>
              </div>
            </div>

            <div className="form-card">
              <div className="eyebrow mb-16">Cấp quyền hàng loạt</div>
              <div className="field">
                <label>Phân tách bằng dấu phẩy hoặc xuống dòng</label>
                <textarea className="textarea" value={batch}
                  onChange={e => setBatch(e.target.value)}
                  placeholder={'0x1A2b…\n0x2B3c…'} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                <button className="btn btn-sm btn-accent"
                  disabled={!batch.trim() || batchAuth}
                  onClick={handleBatchAuthorize}>
                  {batchAuth ? 'Đang cấp quyền…' : 'Cấp hàng loạt'}
                </button>
              </div>
            </div>
          </div>

          <div className="form-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{
              padding: '20px 24px', borderBottom: '1px solid var(--line)',
              display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            }}>
              <div style={{ fontWeight: 600, fontSize: 18 }}>{list.length} cử tri</div>
            </div>
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>Địa chỉ ví</th><th>Trạng thái</th><th></th>
                </tr>
              </thead>
              <tbody>
                {list.map((addr, i) => (
                  <tr key={addr}>
                    <td style={{ color: 'var(--ink-3)' }}>{i + 1}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{addr}</td>
                    <td>
                      <span className="badge badge-open">
                        <span className="dot"></span>Đã cấp quyền
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-sm btn-danger"
                        disabled={revoking === addr}
                        onClick={() => handleRevoke(addr)}>
                        {revoking === addr ? 'Đang thu hồi…' : 'Thu hồi'}
                      </button>
                    </td>
                  </tr>
                ))}
                {list.length === 0 && (
                  <tr><td colSpan={4} className="empty">Chưa cấp quyền cho cử tri nào.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

function AdminsTab({ admins, setAdmins, voterRegistry, election, adminRoleRef, pushToast, setPendingTx }) {
  const [addr, setAddr]         = useState('');
  const [granting, setGranting] = useState(false);
  const [revoking, setRevoking] = useState(null);

  async function handleGrant() {
    const ADMIN_ROLE = adminRoleRef.current;
    if (!addr.startsWith('0x') || !ADMIN_ROLE || granting) return;
    setGranting(true);
    try {
      const tx1 = await voterRegistry.grantRole(ADMIN_ROLE, addr);
      setPendingTx({ label: 'Đang cấp quyền trên VoterRegistry…', hash: tx1.hash });
      await tx1.wait();
      const tx2 = await election.grantRole(ADMIN_ROLE, addr);
      setPendingTx({ label: 'Đang cấp quyền trên Election…', hash: tx2.hash });
      await tx2.wait();
      setAdmins(prev => [...prev, { addr: addr.toLowerCase(), grantedAt: '—', grantedBy: '—' }]);
      pushToast('Đã cấp quyền quản trị trên cả hai contract', 'success');
      setAddr('');
    } catch (e) { pushToast(e.reason ?? e.message, 'error'); }
    finally { setGranting(false); setPendingTx(null); }
  }

  async function handleRevoke(target) {
    const ADMIN_ROLE = adminRoleRef.current;
    if (!ADMIN_ROLE) return;
    setRevoking(target);
    try {
      const tx1 = await voterRegistry.revokeRole(ADMIN_ROLE, target);
      setPendingTx({ label: 'Đang thu hồi quyền trên VoterRegistry…', hash: tx1.hash });
      await tx1.wait();
      const tx2 = await election.revokeRole(ADMIN_ROLE, target);
      setPendingTx({ label: 'Đang thu hồi quyền trên Election…', hash: tx2.hash });
      await tx2.wait();
      setAdmins(prev => prev.filter(a => a.addr !== target.toLowerCase()));
      pushToast('Đã thu hồi quyền quản trị trên cả hai contract', 'success');
    } catch (e) { pushToast(e.reason ?? e.message, 'error'); }
    finally { setRevoking(null); setPendingTx(null); }
  }

  return (
    <>
      <div className="alert alert-info mb-24">
        <span className="ico">i</span>
        <span>
          Cấp/Thu hồi quyền sẽ phát sinh <strong>hai</strong> giao dịch &mdash; một trên VoterRegistry, một trên Election.
        </span>
      </div>

      <div className="form-card mb-24">
        <div className="row-h gap-12" style={{ alignItems: 'flex-end' }}>
          <div className="field grow">
            <label>Cấp ADMIN_ROLE cho địa chỉ</label>
            <input className="input" value={addr}
              onChange={e => setAddr(e.target.value)} placeholder="0x…" />
          </div>
          <button className="btn btn-accent"
            disabled={!addr.startsWith('0x') || granting}
            onClick={handleGrant}>
            {granting ? 'Đang cấp…' : 'Cấp quyền'}
          </button>
        </div>
      </div>

      <div className="form-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--line)' }}>
          <div style={{ fontWeight: 600, fontSize: 18 }}>Danh sách quản trị viên</div>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 40 }}>#</th>
              <th>Địa chỉ ví</th><th>Cấp lúc</th><th>Cấp bởi</th><th></th>
            </tr>
          </thead>
          <tbody>
            {admins.map((a, i) => (
              <tr key={a.addr}>
                <td style={{ color: 'var(--ink-3)' }}>{i + 1}</td>
                <td className="mono" style={{ fontSize: 12 }}>{a.addr}</td>
                <td className="mono">{a.grantedAt}</td>
                <td className="mono">{a.grantedBy}</td>
                <td style={{ textAlign: 'right' }}>
                  <button className="btn btn-sm btn-danger"
                    disabled={admins.length <= 1 || revoking === a.addr}
                    onClick={() => handleRevoke(a.addr)}>
                    {revoking === a.addr ? 'Đang thu hồi…' : 'Thu hồi'}
                  </button>
                </td>
              </tr>
            ))}
            {admins.length === 0 && (
              <tr><td colSpan={5} className="empty">Chưa có dữ liệu quản trị viên.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
