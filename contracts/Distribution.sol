/**
 * SPDX-License-Identifier: MIT
 */
pragma solidity 0.8.18;

import {IERC20, SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/security/ReentrancyGuard.sol';

/**
 * @author Accubits
 * @title DISTRIBUTION
 * @dev Implements a distribution contract to stake ERC20 token
 * Receive rewards on ERC20 token according to the amount staked and time period.
 */
contract Distribution is Ownable, ReentrancyGuard {
  /**
   * @dev Struct representing a user account in the contract.
   * @param balance The current token balance staked by the user.
   * @param forecastedCredits The amount of credits that the user is expected to get.
   * @param lastUpdatedTimestamp The timestamp when the user details were last updated.
   * @param lastClaimedTimestamp The timestamp when the user last claimed their rewards.
   */

  struct User {
    uint256 balance;
    uint256 forecastedCredits;
    uint256 lastUpdatedTimestamp;
    uint256 lastClaimedTimestamp;
    uint256 lastClaimedSlot;
  }

  /**
   * @dev Struct representing the history of profit distribution.
   * @param startTime The timestamp when the profit distribution period started.
   * @param endTime The timestamp when the profit distribution period ended.
   * @param monthlyProfit The total profit for each month.
   * @param totalCredits The total credits distributed in the current distribution.
   * @param remainingTokensToClaim The number of tokens remaining to be claimed by users.
   */

  struct DistributionHistory {
    uint256 startTime;
    uint256 endTime;
    uint256 monthlyProfit;
    uint256 totalCredits;
    uint256 remainingTokensToClaim;
  }

  // constants

  // Representing 5% as 500
  uint256 private constant FIVE_PERCENT = 500;

  // Divisor for percentage calculation (10000 represents two decimal places)
  uint256 private constant PERCENTAGE_DIVISOR = 10000;

  // Number of seconds in an hour
  uint256 private constant SECONDS_IN_AN_HOUR = 3600;

  // Admin claim period update time window
  uint256 private constant ADMIN_CLAIM_PERIOD_TAKE_EFFECT_TIME_WINDOW = 30 days;

  /// The ERC20 token used to stake.
  IERC20 private immutable _token;
  using SafeERC20 for IERC20;

  /// Stores the distribution period in hours.
  uint256 private _slot;

  /// Stores the start timestamp of the current distribution period.
  uint256 private _currentSlotStart;

  /// Stores the end timestamp of the current distribution period.
  uint256 private _currentSlotEnd;

  /// Current credits accumulated.
  uint256 private _totalCredits = 0;

  /// The total amount of tokens staked on the contract.
  uint256 private _totalAmount = 0;

  /// The wallet address where tokens collected as withdrawal fees.
  address private _treasuryWallet;

  /// The withdrawal fee charged when tokens are withdrawn from the contract.
  uint256 private _withdrawalFee;

  /// Mapping of user addresses to their associated User struct.
  mapping(address => User) private _users;

  /// A mapping indicating whether an address is a registered user or not.
  mapping(address => uint256) private _isUser;

  /// An array of all registered user addresses.
  address[] private _userAddresses;

  /// An array of DistributionHistory structs representing the profit distribution history.
  DistributionHistory[] private _distributionHistory;

  /// The slot in which the admin last claimed
  uint256 private _adminLastClaimedSlot;

  /// The admin claim period for rewards claimed by the contract owner.
  uint256 private _adminClaimPeriod;

  /// The variable to store the new proposed admin claim period.
  uint256 private _proposedAdminClaimPeriod;

  /// The admin claim period proposal start timestamp.
  uint256 private _adminClaimPeriodProposalStart;

  /**
   * @dev Event emitted when a user account is deposited with tokens.
   * @param user The address of the user whose account was deposited.
   * @param amount The amount of tokens deposited.
   */
  event Deposit(address indexed user, uint256 amount);

  /**
   * @dev Event emitted when a user account withdraws tokens.
   * @param user The address of the user whose account was withdrawn.
   * @param amount The amount of tokens withdrawn.
   */
  event Withdraw(address indexed user, uint256 amount);

  /**
   * @dev Event emitted when profits are distributed among users.
   * @param amount The total amount of tokens distributed as profits.
   */
  event Distribute(uint256 amount);

  /**
   * @dev Event emitted when a user claims their credits.
   * @param user The address of the user claiming credits.
   * @param amount The amount of credits claimed.
   */
  event Claim(address indexed user, uint256 amount);

  /**
   * @dev Event emitted when the admin claims expired rewards.
   * @param admin The address of the admin claiming rewards.
   * @param amount The amount of credits claimed.
   */
  event AdminClaim(address indexed admin, uint256 amount);

  /**
   * @dev Event emitted when the withdrawal fee is updated.
   * @param fee The new withdrawal fee.
   */
  event WithdrawalFeeUpdated(uint256 fee);

  /**
   * @dev Event emitted when the treasury wallet is updated.
   * @param account The new treasury wallet address.
   */
  event TreasuryWalletUpdated(address account);

  /**
   * @dev Event emitted when the current slot value is updated.
   * @param slot The new slot value.
   */
  event SlotUpdated(uint256 slot);

  /**
   * @dev Event emitted when the admin claim period is updated.
   * @param adminClaimPeriod The new admin claim period.
   */
  event AdminClaimPeriodUpdated(uint256 adminClaimPeriod);

  /**
  * @dev Event emitted when a new user added to the platform.
  * @param account The address of the user.
  */
  event UserAdded(address indexed account);

  /**
  * @dev Event emitted when a new user gets removed from the platform.
  * @param account The address of the user.
  */
  event UserRemoved(address indexed account);

  /**
   * @dev Contract constructor function, sets initial values for various parameters
   * @param admin Address of the owner of the contract
   * @param treasuryWallet Address of the wallet to which fees are sent
   * @param tokenAddress Address of the ERC20 token being used
   * @param slot The time duration of a slot in hours
   * @param adminClaimPeriod The duration within which Admin can claim their tokens after expiration, in hours
   * @param fee Withdrawal fee in basis points (10000 = 100%)
   */
  constructor(
    address admin,
    address treasuryWallet,
    address tokenAddress,
    uint256 slot,
    uint256 adminClaimPeriod,
    uint256 fee
  ) {
    require(treasuryWallet != address(0), 'LINGO: Zero Address');

    _token = IERC20(tokenAddress);
    _updateSlot(slot);
    _updateAdminClaimPeriod(adminClaimPeriod, true);
    _setTreasuryWalletAddress(treasuryWallet);
    _setWithdrawalFee(fee);

    _currentSlotStart = block.timestamp / SECONDS_IN_AN_HOUR;
    _currentSlotEnd = _currentSlotStart + _slot;

    _transferOwnership(admin);
  }

  /**
   * @dev Modifier to check that the user is an active user
   */
  modifier isUser() {
    require(_isUser[msg.sender] > 0, 'LINGO: Not an active user');
    _;
  }

  /**
   * @dev Modifier to check that the current time slot is active and distribution is not on hold
   */

  modifier isActive() {
    require(
      (block.timestamp / SECONDS_IN_AN_HOUR) <= _currentSlotEnd && (block.timestamp / SECONDS_IN_AN_HOUR) >= _currentSlotStart,
      'LINGO: Distribution is on hold. Please contact admin'
    );
    _;
  }

  /**
   * @dev Modifier to check if the user have any unclaimed tokens before depositing or withdrawing
   */

  modifier havePendingClaim() {
    User memory senderDetails = _users[msg.sender];

    if (_distributionHistory.length > 0) {
      DistributionHistory memory lastDistributionDetails = _distributionHistory[
        _distributionHistory.length - 1
      ];
      require(
        (senderDetails.forecastedCredits == 0 && senderDetails.balance == 0) ||
        (senderDetails.lastClaimedTimestamp > lastDistributionDetails.endTime) &&
        (_distributionHistory.length - 1 == senderDetails.lastClaimedSlot),
        'LINGO: User have unclaimed tokens. Please claim it before deposit or withdraw'
      );
    }
    _;
  }

  modifier takeEffectAdminClaimPeriod() {
    if(isNewAdminClaimPeriodTakeEffect()) {
      _adminClaimPeriod = _proposedAdminClaimPeriod;
      delete _proposedAdminClaimPeriod;
    }
    _;
  }

  /**
   * @dev Sets the treasury wallet address to a new value, access restricted to the owner.
   * @param account The new address for the treasury wallet.
   */
  function setTreasuryWalletAddress(address account) external onlyOwner {
    _setTreasuryWalletAddress(account);
  }

  /**
   * @dev Sets the treasury wallet address to a new value.
   * @param account The new address for the treasury wallet.
   */
  function _setTreasuryWalletAddress(address account) internal {
    /// The treasury wallet address cannot be set to the zero-address.
    require(account != address(0), 'LINGO: Zero Address');
    _treasuryWallet = account;
    /// Emits an event when `_treasuryWallet` is updated using this function.
    emit TreasuryWalletUpdated(account);
  }

  /**
   * @dev Updates the slot number to a new value, access restricted to owner.
   * @param newSlot The new value for the slot.
   */
  function updateSlot(uint256 newSlot) external onlyOwner {
    _updateSlot(newSlot);
  }

  /**
   * @dev Updates the slot number to a new value.
   * @param newSlot The new value for the slot.
   */
  function _updateSlot(uint256 newSlot) internal {
    require(newSlot > 0, 'LINGO: Slot cannot be zero');
    _slot = newSlot;
    /// Emits an event when `_slot` is updated using this function.
    emit SlotUpdated(_slot);
  }

  /**
   * @dev Updates the admin claim period to a new value, access restricted to owner.
   * @param newAdminClaimPeriod The new value for the admin claim period.
   */
  function updateAdminClaimPeriod(uint256 newAdminClaimPeriod) external onlyOwner {
    _updateAdminClaimPeriod(newAdminClaimPeriod, false);
  }

  /**
   * @dev Updates the admin claim period to a new value.
   * @param newAdminClaimPeriod The new value for the admin claim period.
   * @param skipTimeLock Flag to skip the time lock and set the admin claim period immediately.
   */
  function _updateAdminClaimPeriod(uint256 newAdminClaimPeriod, bool skipTimeLock) internal {
    require(newAdminClaimPeriod > 0, 'LINGO: Admin claim period cannot be zero');

    // immediately set the new admin claim period if skipTimeLock flag is true
    // this is to aid initial setup of admin claim period without the timelock
    if(skipTimeLock){
      _adminClaimPeriod = newAdminClaimPeriod;
    } else{
      _proposedAdminClaimPeriod = newAdminClaimPeriod;
      _adminClaimPeriodProposalStart = block.timestamp;
    }

    /// Emits an event when `_adminClaimPeriod` is updated using this function.
    emit AdminClaimPeriodUpdated(newAdminClaimPeriod);
  }

  /**
   * @dev Allows user to deposit tokens for staking, and earn rewards for doing so.
   * @param amount Amount of tokens being deposited by the user.
   */
  function deposit(uint256 amount) external isActive havePendingClaim nonReentrant {

    // Here the amount after fee exemption is beeing validated 
    require(amount > 0, 'LINGO: Amount cannot be zero');

    address sender = msg.sender;
    uint256 allowance = _token.allowance(sender, address(this));
    require(allowance >= amount, 'LINGO: Insufficient allowance');

    // Based on the contract balance update, determine the amount has been deposited
    uint256 contractCurrentBalance = _token.balanceOf(address(this));
    _token.safeTransferFrom(sender, address(this), amount);

    uint256 contractUpdatedBalance = _token.balanceOf(address(this));

    uint256 depositedAmount = contractUpdatedBalance - contractCurrentBalance;

    User memory userDetailsTemp = _users[sender];

    // upon claiming any remaing rewards and widrawing the all funds the user will be removed from platfrom
    if (userDetailsTemp.forecastedCredits == 0 && userDetailsTemp.balance == 0) {
        _userAddresses.push(sender);
        _isUser[sender] = _userAddresses.length;

        // Set the ongoing distribution slot to be the last claimed slot
        // In the case of user onboarded before first distribution, the distribution history will be be empty
        _distributionHistory.length > 0 ?  userDetailsTemp.lastClaimedSlot = _distributionHistory.length - 1 : 0;
        userDetailsTemp.lastClaimedTimestamp = block.timestamp / SECONDS_IN_AN_HOUR;

        emit UserAdded(sender);
    }

    // Calculate added credits credits
    uint256 addedCredits = depositedAmount * (_currentSlotEnd - block.timestamp / SECONDS_IN_AN_HOUR);
    // Update user forcasted credits
    userDetailsTemp.forecastedCredits += addedCredits;
    // update total forcasted credits
    _totalCredits += addedCredits;
    /// Add deposited amount to the user's balance.
    userDetailsTemp.balance += depositedAmount;

    /// Update last updated timestamp to current hour.
    userDetailsTemp.lastUpdatedTimestamp = block.timestamp / SECONDS_IN_AN_HOUR;

    /// Add deposited amount to the total amount.
    _totalAmount += depositedAmount;

    // Store the updated user details in the mapping.
    _users[sender] = userDetailsTemp;

    /// Emit deposit event with user's address and deposited amount.
    emit Deposit(sender, depositedAmount);
  }

  /**
   * @dev Allows user to withdraw tokens from their account, and deducts applicable withdrawal fee.
   * @notice Users can only withdraw if they have previously deposited tokens for staking.
   * @param amount Amount of tokens being withdrawn by the user.
   */
  function withdraw(uint256 amount) external isUser isActive havePendingClaim nonReentrant {
    require(amount > 0, 'LINGO: Amount cannot be zero');

    address sender = msg.sender;
    User storage userDetailsTemp = _users[sender];

    require(userDetailsTemp.balance >= amount, 'LINGO: Insufficient balance');

    // Calculate the lost credits
    uint256 lostCredits = amount * (_currentSlotEnd - block.timestamp / SECONDS_IN_AN_HOUR);
    // Update user forcasted credits
    userDetailsTemp.forecastedCredits -= lostCredits;
    // update total forcasted credits
    _totalCredits -= lostCredits;
    /// Deduct the withdrawn amount from user's balance.
    userDetailsTemp.balance -= amount;

    /// Update last updated timestamp to current hour.
    userDetailsTemp.lastUpdatedTimestamp = block.timestamp / SECONDS_IN_AN_HOUR;

    /// Deduct withdrawn amount from total amount.
    _totalAmount -= amount;

    if(userDetailsTemp.forecastedCredits == 0 && userDetailsTemp.balance == 0){
      // remove the user since he no longer have any possesion in this platform
      _removeUser(sender);
    } else {
      // Store the updated user details in the mapping.
      _users[sender] = userDetailsTemp;
    }

    uint256 fee = (amount * _withdrawalFee) / PERCENTAGE_DIVISOR;

    /// Transfer the withdrawal fee to the treasury wallet.
    _transferTokens(_treasuryWallet, fee);

    /// Transfer the withdrawn amount after deducting the withdrawal fee.
    _transferTokens(sender, amount - fee);

    /// Emit withdraw event with user's address and withdrawn amount.
    emit Withdraw(sender, amount);
  }

  /**
   * @dev This method will be called when user needs to be removed from the platform
   *      will be called in the withdraw function when a user withdraws all his possesions from the platform
   * @param account is the address of the user that needs to be removed
   */
  function _removeUser(address account) internal {

    // get the position of the account in the _userAddresses array
    uint256 accountPositionalValue = _isUser[account];
    // get the last element of the _userAddresses array
    address arrayLastAddress = _userAddresses[_userAddresses.length - 1];

    //copy the last account to the position of the account to be removed
    _userAddresses[accountPositionalValue - 1] = arrayLastAddress;
    // Update the last accounts positional value
    _isUser[arrayLastAddress] = accountPositionalValue;

    // remove the last account to avoid duplication
    _userAddresses.pop();
    
    // remove the user account details
    delete _users[account];
    delete _isUser[account];

    emit UserRemoved(account);
  }

  /**
   * @dev Distributes tokens to the contract for last slot.
   * @notice The current month's slot must have expired before distribution can occur and only owner can call this function.
   * @param amount Amount of tokens being distributed.
   */
  function distribute(uint256 amount) external onlyOwner {
    require(amount > 0, 'LINGO: Amount cannot be zero');
    /// Check if the previous slot has expired before distributing tokens for the new slot.
    require(_currentSlotEnd <= (block.timestamp / SECONDS_IN_AN_HOUR), 'LINGO: Current slot is active');

    uint256 allowance = _token.allowance(owner(), address(this));
    /// Ensure that the contract has sufficient token allowance from the owner.
    require(allowance >= amount, 'LINGO: Insufficient allowance');

    _distributionHistory.push(
      DistributionHistory({
        startTime: _currentSlotStart,
        endTime: _currentSlotEnd,
        monthlyProfit: amount,
        totalCredits: _totalCredits,
        remainingTokensToClaim: amount
      })
    );

    /// Update current slot start and end times for the next distribution.
    _currentSlotStart = _currentSlotEnd;
    _currentSlotEnd = _currentSlotEnd + _slot;

    /// Calculate the new total credits based on updated slot end time and total amount.
    _totalCredits = _totalAmount * (_currentSlotEnd - _currentSlotStart);

    /// Emit distribute event with the distributed amount.
    emit Distribute(amount);

    _token.safeTransferFrom(owner(), address(this), amount);
  }

  /**
   * @dev Allows user to claim all available rewards
   */
  function claimRewards() external {
    _claimRewards(_distributionHistory.length);
  }

  /**
   * @dev Allows user to select the number of slots and claim the rewards if any.
   * @param  numberOfSlotsToClaim an unsigned integer represents the number slots to claim.
   */
  function claimRewardsForSlots(uint256 numberOfSlotsToClaim) external {
    _claimRewards(numberOfSlotsToClaim);
  }

  /**
   * @dev Allows user to select the number of slots and claim the rewards if any.
   * @notice User must be active, and cannot claim rewards before current slot has started.
   * @param  numberOfSlotsToClaim an unsigned integer represents the number slots to claim.
   */
  function _claimRewards(uint256 numberOfSlotsToClaim) internal isUser isActive nonReentrant {
    address sender = msg.sender;
    User memory userDetailsTemp = _users[sender];

    /// Ensure that the user has not already claimed rewards for the current slot.
    require(_currentSlotStart > userDetailsTemp.lastClaimedTimestamp, 'LINGO: Already claimed');

    uint256 totalClaim = 0;
    uint256 credits = 0;
    uint256 claim = 0;
    uint256 range = 0;

    /// If no distribution history exists or user has to claim rewards in the last slot only. calculate claim for the last slot.
    if (
      _distributionHistory.length == 1 ||
      (_distributionHistory.length > 1 &&
        (userDetailsTemp.lastClaimedTimestamp >=
          _distributionHistory[_distributionHistory.length - 1].startTime))
    ) {
      if (
        _distributionHistory[_distributionHistory.length - 1].totalCredits > 0 &&
        _distributionHistory[_distributionHistory.length - 1].remainingTokensToClaim > 0
        ) {
        credits = userDetailsTemp.forecastedCredits;
        claim =
          (credits * _distributionHistory[_distributionHistory.length - 1].monthlyProfit) /
          _distributionHistory[_distributionHistory.length - 1].totalCredits;
        totalClaim += claim;

        /// Reduce remaining tokens in the distribution history for the corresponding claim.
        _distributionHistory[_distributionHistory.length - 1].remainingTokensToClaim -= claim;

        userDetailsTemp.lastClaimedSlot = _distributionHistory.length - 1;
      }
    } else {
      if((_distributionHistory.length - userDetailsTemp.lastClaimedSlot) < numberOfSlotsToClaim){
        range = _distributionHistory.length;
      } else {
        range = userDetailsTemp.lastClaimedSlot + numberOfSlotsToClaim;
      }
      //Calculate claim for all slots till last claimed timestamp by user.
      for (uint256 i = userDetailsTemp.lastClaimedSlot; i < range; i++) {
        if (
          _distributionHistory[i].endTime >= userDetailsTemp.lastClaimedTimestamp &&
          _distributionHistory[i].totalCredits > 0 &&
          _distributionHistory[i].remainingTokensToClaim > 0
        ) {
          credits = 0;
          claim = 0;
          /// Calculate credits obtained by the user in the current distribution history slot.
          if (_distributionHistory[i].startTime <= userDetailsTemp.lastClaimedTimestamp) {
            credits = userDetailsTemp.forecastedCredits;
          } else {
            credits =
              userDetailsTemp.balance *
              (_distributionHistory[i].endTime - _distributionHistory[i].startTime);
          }
          /// Calculate user's claim for the current distribution history slot.
          claim =
            (credits * _distributionHistory[i].monthlyProfit) /
            _distributionHistory[i].totalCredits;
          totalClaim += claim;

          /// Reduce remaining tokens in the distribution history for the corresponding claim.
          _distributionHistory[i].remainingTokensToClaim -= claim;

        }
      }

      /// update the last claimed slot for the user so that it will be the starting point for the next claim.
      userDetailsTemp.lastClaimedSlot = range - 1;
    }

    /// Ensure that the total claim amount is greater than zero.
    require(totalClaim > 0, 'LINGO: Zero rewards');

    /// Update user and global forecasted credits based on the current slot end time.
    userDetailsTemp.forecastedCredits = userDetailsTemp.balance * (_currentSlotEnd - _currentSlotStart);

    /// Update last claimed timestamp for the user.
    userDetailsTemp.lastClaimedTimestamp = block.timestamp / SECONDS_IN_AN_HOUR;

    // Store the updated user details in the mapping.
    _users[sender] = userDetailsTemp;

    /// Transfer tokens to the user account.
    _transferTokens(sender, totalClaim);

    /// Emit claim event with the claimed amount.
    emit Claim(sender, totalClaim);
  }

  /**
   * @dev Allows user to claim all available rewards
   */
  function adminClaim() external {
    _adminClaim(_distributionHistory.length);
  }

  /**
  //  * @dev Allows user to select the number of slots and claim the rewards if any.
  //  * @param   numberOfSlotsToClaim an unsigned integer represents the number slots to claim.
  //  */
  function adminClaimForSlots(uint256 numberOfSlotsToClaim) external {
    _adminClaim(numberOfSlotsToClaim);
  }

  /**
   * @dev Claims tokens that were not claimed by users during their distribution period for the owner.
   * @notice The caller must be the contract owner, Only tokens from distribution periods that ended at least `_adminClaimPeriod` hours ago will be claimed,
   * There must be available tokens to claim.
   * @param numberOfSlotsToClaim an unsigned integer represents the number slots to claim.
   */
  function _adminClaim(uint256 numberOfSlotsToClaim) internal onlyOwner takeEffectAdminClaimPeriod nonReentrant {
    uint256 totalClaim = 0;
    uint256 range = 0;

    if((_distributionHistory.length - _adminLastClaimedSlot) < numberOfSlotsToClaim){
        range = _distributionHistory.length;
      } else {
        range = _adminLastClaimedSlot + numberOfSlotsToClaim;
      }

    /// Calculates the total amount of tokens that can be claimed by the owner.
    for (uint256 i = _adminLastClaimedSlot; i < range; i++) {
      if (((block.timestamp / SECONDS_IN_AN_HOUR) - _distributionHistory[i].endTime) >= _adminClaimPeriod) {
        totalClaim += _distributionHistory[i].remainingTokensToClaim;
        _distributionHistory[i].remainingTokensToClaim = 0;
      }
    }

    _adminLastClaimedSlot = range - 1;

    /// Makes sure there are tokens available to claim.
    require(totalClaim > 0, 'LINGO: Zero tokens available to claim');

    /// Transfers the claimed tokens to the owner's address.
    _transferTokens(owner(), totalClaim);

    /// Emits an event indicating that the owner has successfully claimed some tokens.
    emit AdminClaim(owner(), totalClaim);
  }

  /**
   * @dev Returns the address of the wallet that receives treasury funds.
   * @return The Ethereum address of the wallet receiving treasury funds from the contract.
   */
  function getTreasuryWalletAddress() external view returns (address) {
    return _treasuryWallet;
  }

  /**
   * @dev Returns an array of `DistributionHistory` structures containing information about the token distributions.
   * @return An array of `DistributionHistory` structures, each describing a specific token distribution instance.
   */
  function getDistributionHistory() external view returns (DistributionHistory[] memory) {
    return _distributionHistory;
  }

  /**
   * @dev Returns an array of user addresses that staked tokens on the contract.
   * @return An array of Ethereum addresses representing the users who staked tokens on the contract.
   */
  function getUserAddresses() external view returns (address[] memory) {
    return _userAddresses;
  }

  /**
   * @dev Returns the current slot length for token distribution calculations.
   * @return An unsigned integer representing the current slot length for token distribution calculations.
   */
  function getSlot() external view returns (uint256) {
    return _slot;
  }

  /**
   * @dev Returns the duration in hours after which unclaimed tokens can be claimed by the owner.
   * @return An unsigned integer representing the number of hours after which unclaimed tokens can be claimed.
   */
  function getAdminClaimPeriod() external view returns (uint256) {
    if(isNewAdminClaimPeriodTakeEffect()){
      return _proposedAdminClaimPeriod;
    } else {
      return _adminClaimPeriod;
    }
  }

  /**
   * @dev     returns the proposed admin claim period if it is set.
   * @return  uint256  the proposed admin claim period in number of hours.
   */
  function getProposedAdminClaimPeriod() external view returns (uint256) {
    return _proposedAdminClaimPeriod;
  }

  /**
   * @dev  This function is to check whether the time lock is over for the new proposed admin claim period to take effect.
   * @return  bool true if the time lock is over for the new proposed admin claim period to take effect.
   */
  function isNewAdminClaimPeriodTakeEffect() internal view returns (bool) {
    return (
      block.timestamp > (_adminClaimPeriodProposalStart + ADMIN_CLAIM_PERIOD_TAKE_EFFECT_TIME_WINDOW) && 
      _proposedAdminClaimPeriod > 0
    );
  }
  /**
   * @dev Returns the percentage fee charged on withdrawals from the contract.
   * @return An unsigned integer representing the percentage fee charged on withdrawals from the contract.
   */
  function getWithdrawalFee() external view returns (uint256) {
    return _withdrawalFee;
  }

  /**
   * @dev Returns various pieces of state information about the contract.
   * @return startTime - The start time of the current slot.
   * @return endTime - The end time of the current slot.
   * @return totalAmount - The total amount of funds deposited in the contract.
   * @return totalCredits - The total number of credits allocated to users.
   */
  function getContractState()
    external
    view
    returns (uint256 startTime, uint256 endTime, uint256 totalAmount, uint256 totalCredits)
  {
    return (_currentSlotStart, _currentSlotEnd, _totalAmount, _totalCredits);
  }

  /**
   * @dev Returns the address of the token that the contract is distributing.
   * @return The Ethereum address of the token being distributed by this contract.
   */
  function getTokenAddress() external view returns (address) {
    return address(_token);
  }

  /**
   * @dev Returns status information about a specific user account.
   *
   * Requirements:
   * - `account` must be a valid Ethereum address.
   *
   * @param account The Ethereum address of the account to retrieve status information for.
   * @return A `User` struct with details about the specified user's activity on the contract.
   */
  function getUserStatus(address account) external view returns (User memory) {
    return _users[account];
  }

  /**
   * @dev Sets the withdrawal fee charged on withdrawals from the contract. access restricted to owner.
   *
   * Requirements:
   * - Only callable by the owner of the contract.
   * - `fee` must be less than or equal to 5%.
   *
   * @param fee An unsigned integer representing the percentage fee charged on withdrawals from the contract.
   */
  function setWithdrawalFee(uint256 fee) external onlyOwner {
    _setWithdrawalFee(fee);
  }

  /**
   * @dev Sets the withdrawal fee charged on withdrawals from the contract. access restricted to owner.
   *
   * Requirements:
   * - Only callable by the owner of the contract.
   * - `fee` must be less than or equal to 5%.
   *
   * @param fee An unsigned integer representing the percentage fee charged on withdrawals from the contract.
   */
  function _setWithdrawalFee(uint256 fee) internal {
    require(fee <= FIVE_PERCENT, 'LINGO: Withdrawal Fee should be between 0% - 5%');
    _withdrawalFee = fee;
    /// Emitted when `fee` is updated using this function.
    emit WithdrawalFeeUpdated(fee);
  }

  /**
   * @dev Transfers tokens to a specified account address.
   *
   * Requirements:
   * - `_token` must be a valid ERC20 token contract.
   * - `to` must be a valid Ethereum address.
   * - `amount` must be greater than zero and less than or equal to the current balance of the contract.
   *
   * @param to The Ethereum address of the account that will receive tokens from the contract.
   * @param amount An unsigned integer representing the amount of tokens to transfer to `to`.
   */
  function _transferTokens(address to, uint256 amount) internal{
    _token.safeTransfer(to, amount);
  }
} 
