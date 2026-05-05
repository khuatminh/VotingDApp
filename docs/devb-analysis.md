# Phân tích dự án VotingDApp — Góc nhìn Dev B

---

## 1. Dự án làm về cái gì?

**VotingDApp** là một ứng dụng bỏ phiếu phi tập trung (Decentralized Application) chạy trên nền Ethereum.  
Mục tiêu: cho phép admin tạo các cuộc bầu cử, thêm ứng cử viên, cấp quyền bỏ phiếu cho từng cử tri, và công khai kết quả trên blockchain.

Điểm nổi bật:
- **Nhiều cuộc bầu cử song song** — không giới hạn số election cùng lúc.
- **Phân quyền admin** (multi-admin) qua OpenZeppelin `AccessControl`.
- **Xác thực cử tri theo từng election** — mỗi cuộc bầu cử có danh sách cử tri riêng.
- **Ứng cử viên phong phú** — có tên, mô tả, và ảnh đại diện.

---

## 2. Kiến trúc hệ thống

### 2.1 Smart Contracts (Solidity / Foundry)

Hai hợp đồng phối hợp với nhau:

| Hợp đồng | Vai trò | Chủ sở hữu |
|---|---|---|
| `VoterRegistry.sol` | Quản lý danh sách cử tri được phép bỏ phiếu (theo từng electionId) | **Dev A** |
| `Election.sol` | Quản lý vòng đời bầu cử, ứng cử viên, và hành động vote | **Dev B** |

`Election` gọi vào `IVoterRegistry.isAuthorized(electionId, voter)` để kiểm tra quyền trước khi cho vote.

**Vòng đời một Election:**
```
NotStarted → (addCandidate) → Open → (vote) → Ended → (getWinner)
```

### 2.2 Frontend (React / Vite)

| File | Chức năng | Chủ sở hữu |
|---|---|---|
| `wallet.js`, `useWallet.js`, `useContract.js` | Kết nối MetaMask, quản lý ethers.js Contract | Dev A |
| `Layout`, `ConnectButton`, `AddressBadge`, `AdminPage` | UI kết nối ví, trang quản trị | Dev A |
| `ElectionSelector`, `CandidateCard` | Component dropdown chọn election, thẻ ứng cử viên | **Dev B** |
| `VotePage`, `ResultsPage` | Trang bỏ phiếu và xem kết quả | **Dev B** |
| `scripts/sync-abi.sh`, `scripts/dev.sh` | Script đồng bộ ABI + chạy local dev | **Dev B** |

---

## 3. Công nghệ sử dụng

### Backend / Smart Contracts
- **Solidity 0.8.24**
- **Foundry** (forge build, forge test, anvil, forge script)
- **OpenZeppelin Contracts v5** — `AccessControl`
- **forge-std** — cheatcodes cho test (`vm.prank`, `vm.expectRevert`, `vm.expectEmit`)

### Frontend
- **React 18** + **Vite 5**
- **React Router 6**
- **Ethers.js v6** — tương tác với hợp đồng và MetaMask
- **MetaMask** — ví người dùng

### Tooling
- **Bash + jq** — script đồng bộ ABI (`sync-abi.sh`)
- **Anvil** — local blockchain để test

---

## 4. Dev B cần làm gì?

### Phase 1 — Smart Contracts (file: `2026-04-27-devb-phase1-contracts.md`)

Mục tiêu: điền vào tất cả `TODO(Dev B)` trong 3 file contract.

#### Task 1: Constructor + `isAdmin` (`Election.sol`)
- Uncomment storage mapping `_elections`.
- Thêm helper `_election(uint256 id)` để validate và trả về storage pointer.
- Implement constructor: validate `registryAddress != 0`, set `registry`, grant roles cho từng admin.
- Implement `isAdmin()`: return `hasRole(ADMIN_ROLE, account)`.

#### Task 2: Election Lifecycle (`Election.sol` + `Election.t.sol`)
Implement 7 function + 13 test cases:
- `createElection()` — kiểm tra `EmptyName`, tăng `electionCount`, emit `ElectionCreated`.
- `addCandidate()` — kiểm tra state `NotStarted`, tên không rỗng, emit `CandidateAdded`.
- `startElection()` — yêu cầu `NotStarted` và có ít nhất 1 ứng cử viên, emit `ElectionStarted`.
- `endElection()` — yêu cầu đang `Open`, emit `ElectionEnded`.
- `getElection()`, `getCandidate()`, `getCandidateCount()` — các view cần cho test lifecycle.

#### Task 3: Vote (`Election.sol` + `Election.t.sol`)
Implement `vote()` + 5 test cases:
- Kiểm tra state `Open`, voter được authorize qua `registry.isAuthorized()`, chưa vote, candidateId hợp lệ.
- Tăng `voteCount` và `totalVotes`, emit `VoteCast`.

#### Task 4: Complex Views (`Election.sol` + `Election.t.sol`)
Implement 2 view + 5 test cases:
- `getResults()` — trả về mảng tất cả ứng cử viên.
- `getWinner()` — yêu cầu state `Ended` và `totalVotes > 0`; tìm max voteCount (tiebreak = id nhỏ nhất).
- Test concurrent elections: vote ở election 0 không ảnh hưởng election 1.
- Xóa `error TODO()` sau khi xong.

#### Task 5: Deploy Script (`Deploy.s.sol`)
- `_parseSeedAdmins()`: đọc env `SEED_ADMINS` (CSV), fallback về deployer.
- `run()`: đọc `PRIVATE_KEY`, deploy `VoterRegistry` rồi `Election` (cùng danh sách admin), log địa chỉ.

---

### Phase 2 — Frontend (file: `2026-04-27-devb-phase2-frontend.md`)

Mục tiêu: thay thế tất cả `TODO(Dev B)` trong 4 file frontend bằng code React hoạt động.

#### Task 1: `ElectionSelector.jsx`
- Dùng `useContract().election` để đọc `electionCount` rồi loop gọi `getElection(i)`.
- Nhận prop `filter` (ví dụ: chỉ show election đang `Open`).
- Render `<select>` với loading/empty state.

#### Task 2: `CandidateCard.jsx`
- Render ảnh với fallback khi URL hỏng (dùng `onError`).
- Hiển thị `voteCount` (BigInt từ ethers → `String()`).
- Nút Vote gọi `onVote(candidate.id)`, disable theo prop `disabled`.

#### Task 3: `VotePage.jsx` + thêm CSS
- Hiển thị `ElectionSelector` filter chỉ election `Open` (state = 1).
- Load danh sách ứng cử viên qua `election.getCandidateCount()` + `election.getCandidate()`.
- Kiểm tra authorization qua `voterRegistry.isAuthorized()`.
- Kiểm tra đã vote chưa qua query event `VoteCast(electionId, null, address)`.
- Xử lý vote: gọi `election.vote()`, đợi `tx.wait()`, refresh vote counts.
- Thêm CSS `.candidate-grid` vào `index.css`.

#### Task 4: `ResultsPage.jsx`
- Render theo state của election:
  - `NotStarted` → thông báo chưa bắt đầu.
  - `Open` → hiển thị vote counts trực tiếp, subscribe event `VoteCast` để cập nhật live.
  - `Ended` → gọi `election.getWinner()`, hiển thị người thắng và bảng điểm cuối.

#### Task 5: End-to-end demo
Chạy `bash scripts/dev.sh` và walk through 6 bước demo đầy đủ.

---

## 5. Thứ tự ưu tiên thực hiện

```
Phase 1 (Contracts):
  Task 1 → Task 2 → Task 3 → Task 4 → Task 5
  (Mỗi task: viết test fail → implement → verify green → commit)

Phase 2 (Frontend — chỉ bắt đầu sau khi Phase 1 xong):
  Prerequisite: forge test green + contracts deployed + Dev A hoàn thành wallet/useContract
  Task 1 → Task 2 → Task 3 → Task 4 → Task 5
```

---

## 6. Các file Dev B sở hữu (tóm tắt)

| File | Phase |
|---|---|
| `contracts/src/Election.sol` | Phase 1 |
| `contracts/test/Election.t.sol` | Phase 1 |
| `contracts/script/Deploy.s.sol` | Phase 1 |
| `frontend/src/components/ElectionSelector.jsx` | Phase 2 |
| `frontend/src/components/CandidateCard.jsx` | Phase 2 |
| `frontend/src/pages/VotePage.jsx` | Phase 2 |
| `frontend/src/pages/ResultsPage.jsx` | Phase 2 |
| `scripts/sync-abi.sh` | Phase 1/2 |
| `scripts/dev.sh` | Phase 1/2 |

---

## 7. Các điểm kỹ thuật quan trọng cần nhớ

- **`_election(id)` helper**: dùng cho mọi hàm cần truy cập election đã tồn tại. Khi `createElection`, phải truy cập `_elections[electionId]` **trực tiếp** (không qua helper) vì slot chỉ hợp lệ sau khi tăng `electionCount`.
- **Tiebreak getWinner**: dùng `>` (strictly greater) thay vì `>=` để giữ ứng cử viên id nhỏ nhất khi hòa.
- **`vm.envAddress(key, delimiter)`** trong Deploy script thay vì tự parse chuỗi CSV.
- **ElectionSelector**: dùng cancellation flag (`let cancelled = false`) trong `useEffect` để tránh setState sau khi component unmount.
- **VotePage has-voted**: detect bằng `election.queryFilter(VoteCast(electionId, null, address))`, không cần view riêng trong contract.
- **ResultsPage live update**: dùng `election.on(filter, handler)` khi election Open, cleanup với `election.off()` trong return của `useEffect`.
- **State enum mapping** (frontend): `0 = NotStarted`, `1 = Open`, `2 = Ended`.
