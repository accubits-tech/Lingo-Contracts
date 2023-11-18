/**
 * SPDX-License-Identifier: MIT
 */
pragma solidity 0.8.18;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol';

/**
 * @author Accubits
 * @title LINGO
 * @dev Implements a custom ERC20 token.
 */
contract LINGO is ERC20, ERC20Burnable, Ownable {
  /**
   * @title  WhiteList Types
   * @notice This enum specifies the types of whitelists available - external or internal.
   */
  enum WhiteListTypes {
    EXTERNAL_WHITELISTED,
    INTERNAL_WHITELISTED
  }

  /// This is an unsigned integer that represents the transfer fee percentage
  /// Eg: 5% will be represented as 500
  uint256 private _transferFee;

  /// This is an address variable that will hold the treasury wallet's address
  address private _treasuryWallet;

  /// This creates a mapping between external addresses and a boolean value indicating if they're whitelisted
  mapping(address => bool) private _isExternalWhiteListed;

  /// This creates a mapping between internal addresses and a boolean value indicating if they're whitelisted
  mapping(address => bool) private _isInternalWhiteListed;

  /// This is an array that stores all external white listed addresses
  address[] private _externalWhitelistedAddresses;

  /// This is an array that stores all internal white listed addresses
  address[] private _internalWhitelistedAddresses;

  /**
   * @dev Emitted when the Treasury wallet is updated
   * @param account The new account address that will be set as the treasury wallet
   */
  event TreasuryWalletUpdated(address account);

  /**
   * @dev Emitted when the whitelist is updated
   * @param whiteListType A variable of type `WhiteListTypes` indicating external or internal whitelists.
   * @param added The boolean value for whether an address has been added to the whitelisted addresses or removed..
   * @param members An array of addresses representing the members being added or removed from the list.
   */
  event WhiteListUpdated(WhiteListTypes whiteListType, bool added, address[] members);

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
   * @param whiteListType The type of whitelist to remove from
   * @param users An array of addresses to remove from the whitelist
   */
  function removeFromWhiteList(
    WhiteListTypes whiteListType,
    address[] memory users
  ) external onlyOwner {
    if (whiteListType == WhiteListTypes.EXTERNAL_WHITELISTED) {
      _removeFromExternalWhiteList(users);
    } else if (whiteListType == WhiteListTypes.INTERNAL_WHITELISTED) {
      _removeFromInternalWhiteList(users);
    }
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
  function isExternalWhiteListed(address account) external view returns (bool) {
    return _isExternalWhiteListed[account];
  }

  /**
   * @dev Checks if the given account is internal white-listed.
   * @param account The wallet address to be checked in the white-list.
   * @return bool `true` if the account is white-listed, `false` otherwise.
   */
  function isInternalWhiteListed(address account) external view returns (bool) {
    return _isInternalWhiteListed[account];
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
   * @dev Returns an array of addresses that are whitelisted for external users.
   * @return address[] memory An array of whitelisted addresses.
   */
  function getExternalWhitelistedAddresses() external view returns (address[] memory) {
    return _externalWhitelistedAddresses;
  }

  /**
   * @dev Returns an array of addresses that are whitelisted for internal users.
   * @return address[] memory An array of whitelisted addresses.
   */
  function getInternalWhitelistedAddresses() external view returns (address[] memory) {
    return _internalWhitelistedAddresses;
  }

  /**
   * @dev Sets the transfer fee percentage that must be paid by the token sender.
   * @param fee transfer fee in percentage.Eg: 5% as 500.
   * @notice Function can only be called by contract owner.
   */
  function setTransferFee(uint256 fee) public onlyOwner {
    /// Require the fee to be less than or equal to 5%.
    require(fee <= 500, 'LINGO: Transfer Fee should be between 0% - 5%');
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
    address sender = _msgSender();
    if (_isFeeRequired(sender, to)) {
      uint256 fee = (amount * _transferFee) / 10000;
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
    address spender = _msgSender();
    _spendAllowance(from, spender, amount);
    if (_isFeeRequired(from, to)) {
      uint256 charge = (amount * _transferFee) / 10000;
      _transfer(from, _treasuryWallet, charge);
      _transfer(from, to, amount - charge);
    } else {
      _transfer(from, to, amount);
    }
    return true;
  }

  /**
   * @dev Adds addresses to the specified whitelist.
   * @param whiteListType The type of the whitelist (external or internal).
   * @param users The addresses to be added.
   */
  function addToWhiteList(WhiteListTypes whiteListType, address[] memory users) public onlyOwner {
    if (whiteListType == WhiteListTypes.EXTERNAL_WHITELISTED) {
      for (uint i = 0; i < users.length; i++) {
        /// Check if address is already whitelisted
        if (_isExternalWhiteListed[users[i]]) continue;

        /// If not, add it to external whitelist and mark as true
        _externalWhitelistedAddresses.push(users[i]);
        _isExternalWhiteListed[users[i]] = true;
      }
      emit WhiteListUpdated(whiteListType, true, users);
    } else if (whiteListType == WhiteListTypes.INTERNAL_WHITELISTED) {
      for (uint i = 0; i < users.length; i++) {
        /// Check if address is already whitelisted
        if (_isInternalWhiteListed[users[i]]) continue;

        /// If not, add it to internal whitelist and mark as true
        _internalWhitelistedAddresses.push(users[i]);
        _isInternalWhiteListed[users[i]] = true;
      }
      emit WhiteListUpdated(whiteListType, true, users);
    }
  }

  /**
   * @dev Removes one or multiple users from the internal whitelist.
   * Only the contract owner can call this function.
   *
   * @param users Array of addresses to remove from the whitelist
   */
  function _removeFromInternalWhiteList(address[] memory users) internal onlyOwner {
    bool removed = false;
    for (uint i = 0; i < users.length; i++) {
      /// Check if address is already removed from whitelist
      if (!_isInternalWhiteListed[users[i]]) continue;

      removed = false;
      for (uint j = 0; j < _internalWhitelistedAddresses.length; j++) {
        if (users[i] == _internalWhitelistedAddresses[j]) {
          _isInternalWhiteListed[users[i]] = false;

          /// Swap the removed address with the last address in the array and pop it off
          _internalWhitelistedAddresses[j] = _internalWhitelistedAddresses[
            _internalWhitelistedAddresses.length - 1
          ];
          _internalWhitelistedAddresses.pop();

          removed = true;
          break;
        }
      }
    }
    if (removed) emit WhiteListUpdated(WhiteListTypes.INTERNAL_WHITELISTED, false, users);
  }

  /**
   * @dev Removes one or multiple users from the external whitelist.
   * Only the contract owner can call this function.
   *
   * @param users Array of addresses to remove from the whitelist
   */
  function _removeFromExternalWhiteList(address[] memory users) internal onlyOwner {
    bool removed = false;
    for (uint i = 0; i < users.length; i++) {
      /// Check if address is already removed from whitelist
      if (!_isExternalWhiteListed[users[i]]) continue;

      removed = false;
      for (uint j = 0; j < _externalWhitelistedAddresses.length; j++) {
        if (users[i] == _externalWhitelistedAddresses[j]) {
          _isExternalWhiteListed[users[i]] = false;

          /// Swap the removed address with the last address in the array and pop it off
          _externalWhitelistedAddresses[j] = _externalWhitelistedAddresses[
            _externalWhitelistedAddresses.length - 1
          ];
          _externalWhitelistedAddresses.pop();

          removed = true;
          break;
        }
      }
    }
    if (removed) emit WhiteListUpdated(WhiteListTypes.EXTERNAL_WHITELISTED, false, users);
  }

  /**
   * @dev This function sets the default whitelist that contains three addresses: owner, contract address and treasury wallet.
   * @notice The function is internal and cannot be called outside the contract.
   */
  function _setDefaultWhitelist() internal {
    address[3] memory defaultWhiteListedAddresses = [owner(), address(this), _treasuryWallet];

    /// We create a dynamic array of addresses using memory allocation with length equal to defaultWhitelistedAddresses length.

    address[] memory defaultWhiteListedAddressesDynamic = new address[](
      defaultWhiteListedAddresses.length
    );

    /// Copying the elements from static to dynamic array.
    for (uint i = 0; i < defaultWhiteListedAddresses.length; i++) {
      defaultWhiteListedAddressesDynamic[i] = defaultWhiteListedAddresses[i];
    }

    addToWhiteList(WhiteListTypes.INTERNAL_WHITELISTED, defaultWhiteListedAddressesDynamic);
  }

  /**
   * @dev Check if fee is required for transfer.
   * @param from The address sending the tokens.
   * @param to The address receiving the tokens.
   * @return bool True if fee is required, false otherwise.
   */
  function _isFeeRequired(address from, address to) internal view returns (bool) {
    if (
      !_isInternalWhiteListed[from] && !_isInternalWhiteListed[to] && !_isExternalWhiteListed[to]
    ) {
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
