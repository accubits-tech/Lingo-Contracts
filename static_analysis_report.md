Summary
 - [timestamp](#timestamp) (5 results) (Low)
 - [pragma](#pragma) (1 results) (Informational)
 - [solc-version](#solc-version) (7 results) (Informational)
 - [similar-names](#similar-names) (2 results) (Informational)
## timestamp
Impact: Low
Confidence: Medium
 - [ ] ID-0
[Distribution.withdraw(uint256)](contracts/Distribution.sol#L301-L343) uses timestamp for comparisons
	Dangerous comparisons:
	- [require(bool,string)(userDetails.balance >= amount,LINGO: Insufficient balance)](contracts/Distribution.sol#L307)

contracts/Distribution.sol#L301-L343


 - [ ] ID-1
[Distribution.claimRewards()](contracts/Distribution.sol#L387-L461) uses timestamp for comparisons
	Dangerous comparisons:
	- [require(bool,string)(_currentSlotStart > userDetails.lastClaimedTimestamp,LINGO: Already claimed)](contracts/Distribution.sol#L392)
	- [_totalCredits > 0](contracts/Distribution.sol#L448)

contracts/Distribution.sol#L387-L461


 - [ ] ID-2
[Distribution.adminClaim()](contracts/Distribution.sol#L469-L489) uses timestamp for comparisons
	Dangerous comparisons:
	- [((block.timestamp / 3600) - _distributionHistory[i].endTime) >= _adminClaimPeriod](contracts/Distribution.sol#L474)

contracts/Distribution.sol#L469-L489


 - [ ] ID-3
[Distribution.distribute(uint256)](contracts/Distribution.sol#L350-L381) uses timestamp for comparisons
	Dangerous comparisons:
	- [require(bool,string)(_currentSlotEnd <= (block.timestamp / 3600),LINGO: Current slot is active)](contracts/Distribution.sol#L353)

contracts/Distribution.sol#L350-L381


 - [ ] ID-4
[Distribution.deposit(uint256)](contracts/Distribution.sol#L252-L294) uses timestamp for comparisons
	Dangerous comparisons:
	- [_totalCredits > 0](contracts/Distribution.sol#L262)

contracts/Distribution.sol#L252-L294


## pragma
Impact: Informational
Confidence: High
 - [ ] ID-5
Different versions of Solidity are used:
	- Version used: ['0.8.18', '^0.8.0']
	- [0.8.18](contracts/Distribution.sol#L4)
	- [0.8.18](contracts/Lingo.sol#L4)
	- [^0.8.0](node_modules/@openzeppelin/contracts/access/Ownable.sol#L4)
	- [^0.8.0](node_modules/@openzeppelin/contracts/security/ReentrancyGuard.sol#L4)
	- [^0.8.0](node_modules/@openzeppelin/contracts/token/ERC20/ERC20.sol#L4)
	- [^0.8.0](node_modules/@openzeppelin/contracts/token/ERC20/IERC20.sol#L4)
	- [^0.8.0](node_modules/@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol#L4)
	- [^0.8.0](node_modules/@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol#L4)
	- [^0.8.0](node_modules/@openzeppelin/contracts/utils/Context.sol#L4)

contracts/Distribution.sol#L4


## solc-version
Impact: Informational
Confidence: High
 - [ ] ID-6
Pragma version[^0.8.0](node_modules/@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol#L4) allows old versions

node_modules/@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol#L4


 - [ ] ID-7
Pragma version[^0.8.0](node_modules/@openzeppelin/contracts/utils/Context.sol#L4) allows old versions

node_modules/@openzeppelin/contracts/utils/Context.sol#L4


 - [ ] ID-8
Pragma version[^0.8.0](node_modules/@openzeppelin/contracts/security/ReentrancyGuard.sol#L4) allows old versions

node_modules/@openzeppelin/contracts/security/ReentrancyGuard.sol#L4


 - [ ] ID-9
Pragma version[^0.8.0](node_modules/@openzeppelin/contracts/token/ERC20/IERC20.sol#L4) allows old versions

node_modules/@openzeppelin/contracts/token/ERC20/IERC20.sol#L4


 - [ ] ID-10
Pragma version[^0.8.0](node_modules/@openzeppelin/contracts/token/ERC20/ERC20.sol#L4) allows old versions

node_modules/@openzeppelin/contracts/token/ERC20/ERC20.sol#L4


 - [ ] ID-11
Pragma version[^0.8.0](node_modules/@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol#L4) allows old versions

node_modules/@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol#L4


 - [ ] ID-12
Pragma version[^0.8.0](node_modules/@openzeppelin/contracts/access/Ownable.sol#L4) allows old versions

node_modules/@openzeppelin/contracts/access/Ownable.sol#L4


## similar-names
Impact: Informational
Confidence: Medium
 - [ ] ID-13
Variable [LINGO._externalWhitelistedAddresses](contracts/Lingo.sol#L39) is too similar to [LINGO._internalWhitelistedAddresses](contracts/Lingo.sol#L42)

contracts/Lingo.sol#L39


 - [ ] ID-14
Variable [LINGO._isExternalWhiteListed](contracts/Lingo.sol#L33) is too similar to [LINGO._isInternalWhiteListed](contracts/Lingo.sol#L36)

contracts/Lingo.sol#L33


