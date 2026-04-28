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
        uint256 pk       = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        address[] memory admins = _parseSeedAdmins(deployer);

        vm.startBroadcast(pk);
        registry = new VoterRegistry(admins);
        election  = new Election(address(registry), admins);
        vm.stopBroadcast();

        console2.log("VoterRegistry:", address(registry));
        console2.log("Election:     ", address(election));
    }

    /// @dev Parses `SEED_ADMINS` (comma-separated). Falls back to [deployer] if unset/empty.
    function _parseSeedAdmins(address deployer) internal view returns (address[] memory) {
        try vm.envAddress("SEED_ADMINS", ",") returns (address[] memory parsed) {
            if (parsed.length > 0) return parsed;
        } catch {}
        address[] memory fallback_ = new address[](1);
        fallback_[0] = deployer;
        return fallback_;
    }
}
