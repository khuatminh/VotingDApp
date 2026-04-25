// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {VoterRegistry} from "../src/VoterRegistry.sol";
import {Election}      from "../src/Election.sol";

/// @title Deploy
/// @notice Deploys VoterRegistry and Election with a shared initial-admin set.
/// @dev SKELETON. Parses PRIVATE_KEY + optional SEED_ADMINS env vars. Spec §4.4.
contract Deploy is Script {
    function run() external returns (VoterRegistry registry, Election election) {
        // TODO(Dev B):
        //   1. uint256 pk = vm.envUint("PRIVATE_KEY");
        //   2. address deployer = vm.addr(pk);
        //   3. address[] memory admins = _parseSeedAdmins(deployer);
        //   4. vm.startBroadcast(pk);
        //        registry = new VoterRegistry(admins);
        //        election = new Election(address(registry), admins);
        //      vm.stopBroadcast();
        //   5. console2.log("VoterRegistry:", address(registry));
        //   6. console2.log("Election:",      address(election));
        return (VoterRegistry(address(0)), Election(address(0)));
    }

    /// @dev Parses `SEED_ADMINS` (comma-separated). Falls back to [deployer] if unset/empty.
    function _parseSeedAdmins(address deployer) internal view returns (address[] memory admins) {
        // TODO(Dev B):
        //   - try vm.envString("SEED_ADMINS"); on empty/not-set -> return [deployer]
        //   - split on ","; parse each with vm.parseAddress; trim whitespace
        //   - return the resulting array
        deployer;
        admins = new address[](0);
    }
}
