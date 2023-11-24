/**
 * SPDX-License-Identifier: MIT
 */
pragma solidity 0.8.18;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol';

/**
 * @author Accubits
 * @title LINGO
 * @dev Implements a custom ERC20 token.
 */
contract LINGO is ERC20Burnable, Ownable {

  // Constants

  // Representing 5% as 500
  uint256 private constant FIVE_PERCENT = 500;

  // Divisor for percentage calculation (10000 represents two decimal places)
  uint256 private constant PERCENTAGE_DIVISOR = 10000;

  /// This is an unsigned integer that represents the transfer fee percentage
  /// Eg: 5% will be represented as 500
  uint256 private _transferFee;

  /// This is an address variable that will hold the treasury wallet's address
  address private _treasuryWallet;

  // An 'address - white list type' combination of inputs provides a positional value (index + 1) which points to the location to the address list, 0 if not whitelisted
  mapping(address => mapping(bool => uint256)) private _isAddressWhiteListed;

  // the list of white listed addresses
  address[] private _whitelistedAddresses;

  /**
   * @dev Emitted when the Treasury wallet is updated
   * @param account The new account address that will be set as the treasury wallet
   */
  event TreasuryWalletUpdated(address account);

  /**
   * @dev Emitted when the whitelist is updated
   * @param isInternal Is a boolean type denote internal type if true and external otherwise
   * @param added The boolean value for whether an address has been added to the whitelisted addresses or removed..
   * @param members An array of addresses representing the members being added or removed from the list.
   */
  event WhiteListUpdated(bool isInternal, bool added, address[] members);

  /**
   * @dev Event emitted when the transfer fee is updated
   * @param fee The updated transfer fee to be set as a uint256 value
   */
  event TransferFeeUpdated(uint256 fee);

  /**
   * @dev Constructor function to initialize values when the contract is created.
   * @param name_ A string representing the name of the token.
   * @param symbol_ A string representing the symbol of the token.
   * @param totalSupply_ An unsigned integer representing the initial total supply of tokens for the contract.
   * @param owner_ An address representing the owner of the contract.
   * @param treasuryAddress_ An address representing the treasury wallet address.
   * @param txnFee_ An unsigned integer representing the percentage transfer fee associated with each token transfer.
   */
  constructor(
    string memory name_,
    string memory symbol_,
    uint256 totalSupply_,
    address owner_,
    address treasuryAddress_,
    uint256 txnFee_
  ) ERC20(name_, symbol_) {
    /**
     * Here, we set the treasury wallet address to the specified value.
     * This address will be used to receive the transfer fee from every token transfer.
     */
    require(treasuryAddress_ != address(0), 'LINGO: Zero Address');
    _treasuryWallet = treasuryAddress_;

    /**
     * The total supply of tokens is calculated in the next line
     * by multiplying the specified value by 10 raised to the power of decimals.
     * This is because the token has a fixed number of decimal places,
     * which can be specified by adding a 'decimals' variable to the contract.
     * Finally, the tokens are minted and assigned to the contract owner's address.
     */
    uint256 intialTokenSupply = totalSupply_ * (10 ** decimals());
    _mint(owner_, intialTokenSupply);

    /**
     * In the next line, we set the transfer fee percentage for the token transfers.
     * This is the amount that will be deducted from the transferred amount as a fee
     * and added to the treasury wallet.
     */
    setTransferFee(txnFee_);

    /**
     * The ownership of the contract is transferred to the specified owner address.
     * This provides full control over the contract to the owner.
     */
    _transferOwnership(owner_);

    /**
     * In the final line, we set up the default whitelist.
     * The whitelist ensures that certain addresses can have special permissions within the contract.
     * For instance, they may be able to transfer tokens even if a transfer fee is in place.
     * This function sets the default whitelist for all addresses.
     */
    _setDefaultWhitelist();
  }

  /**
   * @dev Sets the treasury wallet address where transfer fees will be credited.
   * @param account The wallet address of the treasury.
   * @notice Function can only be called by contract owner.
   */
  function setTreasuryWalletAddress(address account) external onlyOwner {
    /// The treasury wallet address cannot be zero-address.
    require(account != address(0), 'LINGO: Zero Address');
    _treasuryWallet = account;
    /// Emitted when `_treasuryWallet` is updated using this function.
    emit TreasuryWalletUpdated(account);
  }

  /**
   * @dev Removes one or more addresses from a specific whitelist
   * @param isInternal The type of whitelist to remove from True if internal False if external
   * @param users An array of addresses to remove from the whitelist
   */
  function removeFromWhiteList(
    bool isInternal,
    address[] memory users
  ) external onlyOwner returns (bool isUserRemoved) {
    isUserRemoved = _removeFromWhiteList(isInternal, users);
  }

  /**
   * @dev Mint new tokens.
   * @param to The address to mint the tokens to.
   * @param amount The amount of tokens to mint.
   */
  function mint(address to, uint256 amount) external onlyOwner {
    _mint(to, amount);
  }

  /**
   * @dev Returns the current transfer fee percentage.
   * @return _transferFee the current transfer fee percentage.
   */
  function getTransferFee() external view returns (uint256) {
    return _transferFee;
  }

  /**
   * @dev Checks if the given account is external white-listed.
   * @param account The wallet address to be checked in the white-list.
   * @return bool `true` if the account is white-listed, `false` otherwise.
   */
  function isExternalWhiteListed(address account) public view returns (bool) {
    return _isAddressWhiteListed[account][false] > 0;
  }

  /**
   * @dev Checks if the given account is internal white-listed.
   * @param account The wallet address to be checked in the white-list.
   * @return bool `true` if the account is white-listed, `false` otherwise.
   */
  function isInternalWhiteListed(address account) public view returns (bool) {
    return _isAddressWhiteListed[account][true] > 0;
  }

  /**
   * @dev Returns the current treasury wallet address.
   * @return _treasuryWallet The current treasury wallet address.
   * @notice Function can only be called by contract owner.
   */
  function getTreasuryWalletAddress() external view returns (address) {
    return _treasuryWallet;
  }

  /**
   * @dev Returns an array of whitelisted addresses.
   * @return address[] memory An array of whitelisted addresses.
   */
  function getWhitelistedAddresses() external view returns (address[] memory) {
    return _whitelistedAddresses;
  }

  /**
   * @dev Sets the transfer fee percentage that must be paid by the token sender.
   * @param fee transfer fee in percentage.Eg: 5% as 500.
   * @notice Function can only be called by contract owner.
   */
  function setTransferFee(uint256 fee) public onlyOwner {
    /// Require the fee to be less than or equal to 5%.
    require(fee <= FIVE_PERCENT, 'LINGO: Transfer Fee should be between 0% - 5%');
    _transferFee = fee;
    /// Emitted when `fee` is updated using this function.
    emit TransferFeeUpdated(fee);
  }

  /**
   * @dev Transfer tokens from sender to another address.
   * @param to The address to transfer the tokens to.
   * @param amount The amount of tokens to transfer.
   * @return bool True if transfer is successful, false otherwise.
   */
  function transfer(address to, uint256 amount) public virtual override returns (bool) {
    address sender = msg.sender;
    if (_isFeeRequired(sender, to)) {
      uint256 fee = (amount * _transferFee) / PERCENTAGE_DIVISOR;
      _transfer(sender, _treasuryWallet, fee);
      _transfer(sender, to, amount - fee);
    } else {
      _transfer(sender, to, amount);
    }
    return true;
  }

  /**
   * @dev Transfer tokens from one address to another on behalf of a sender.
   * @param from The address to transfer tokens from.
   * @param to The address to transfer tokens to.
   * @param amount The amount of tokens to transfer.
   * @return bool True if transfer is successful, false otherwise.
   */
  function transferFrom(
    address from,
    address to,
    uint256 amount
  ) public virtual override returns (bool) {
    address spender = msg.sender;
    _spendAllowance(from, spender, amount);
    if (_isFeeRequired(from, to)) {
      uint256 charge = (amount * _transferFee) / PERCENTAGE_DIVISOR;
      _transfer(from, _treasuryWallet, charge);
      _transfer(from, to, amount - charge);
    } else {
      _transfer(from, to, amount);
    }
    return true;
  }

  /**
   * @dev Adds addresses to the specified whitelist.
   * @param isInternal The type of whitelist to remove from True if internal False if external
   * @param users The addresses to be added.
   */
  function addToWhiteList(bool isInternal, address[] memory users) public onlyOwner {
    for (uint i = 0; i < users.length; i++) {
      /// Check if address is already whitelisted
      if (_isAddressWhiteListed[users[i]][isInternal] > 0) continue;

      // checks the other type alresy exists then only assign the same positional value to the given type
      if (
          _isAddressWhiteListed[users[i]][!isInternal] > 0
      ) {
        _isAddressWhiteListed[users[i]][isInternal] = _isAddressWhiteListed[users[i]][!isInternal];
      } else {
        /// If not, add it to the whitelist and mark as true
        _whitelistedAddresses.push(users[i]);
        _isAddressWhiteListed[users[i]][isInternal] = _whitelistedAddresses.length;
      }
    }
  }

  /**
   * @dev Removes one or multiple users from the internal whitelist.
   * Only the contract owner can call this function.
   *
   * @param users Array of addresses to remove from the whitelist
   */
  function _removeFromWhiteList(
    bool isInternal,
    address[] memory users
  ) internal returns (bool) {
    bool isRemoved = true;
    for (uint i = 0; i < users.length; i++) {
      /// Check if the address is present in the whitelist

      uint256 addressPositionalValue = _isAddressWhiteListed[users[i]][isInternal];
      if (!(addressPositionalValue > 0)) {
        isRemoved = false;
        continue;
      }

      uint256 addressPositionalValueOtherType = _isAddressWhiteListed[users[i]][!isInternal];

      // Check if the address is present in the whitelist in the other type
      // if not then the address removed from the whitlisted addresses
      if(addressPositionalValueOtherType == 0){
        if (_whitelistedAddresses.length > 1) {
          address lastAddress = _whitelistedAddresses[_whitelistedAddresses.length - 1];
          /// Swap the removed address with the last address in the array and pop it off
          _whitelistedAddresses[addressPositionalValue - 1] = lastAddress;
    
          if(_isAddressWhiteListed[lastAddress][isInternal] > 0) 
            _isAddressWhiteListed[lastAddress][isInternal] = addressPositionalValue;
          if(_isAddressWhiteListed[lastAddress][!isInternal] > 0) 
            _isAddressWhiteListed[lastAddress][!isInternal] = addressPositionalValue;
        }
        _whitelistedAddresses.pop();
      }

      _isAddressWhiteListed[users[i]][isInternal] = 0;
    }
    if (isRemoved) emit WhiteListUpdated(isInternal, false, users);
    return isRemoved;
  }

  /**
   * @dev This function sets the default whitelist that contains three addresses: owner, contract address and treasury wallet.
   * @notice The function is internal and cannot be called outside the contract.
   */
  function _setDefaultWhitelist() internal {
    address[] memory defaultWhiteListedAddresses = new address[](3);
    defaultWhiteListedAddresses[0] = owner();
    defaultWhiteListedAddresses[1] = address(this);
    defaultWhiteListedAddresses[2] = _treasuryWallet;

    addToWhiteList(true, defaultWhiteListedAddresses);
  }

  /**
   * @dev Check if fee is required for transfer.
   * @param from The address sending the tokens.
   * @param to The address receiving the tokens.
   * @return bool True if fee is required, false otherwise.
   */
  function _isFeeRequired(address from, address to) internal view returns (bool) {
    if (!isInternalWhiteListed(from) && !isInternalWhiteListed(to) && !isExternalWhiteListed(to)) {
      return true;
    }
    return false;
  }

  /**
   * @dev Hook function that is called before any token transfer.
   * @param from The address tokens are transferred from.
   * @param to The address tokens are transferred to.
   * @param amount The amount of tokens being transferred.
   */
  function _beforeTokenTransfer(address from, address to, uint256 amount) internal override {
    super._beforeTokenTransfer(from, to, amount);
  }
}
