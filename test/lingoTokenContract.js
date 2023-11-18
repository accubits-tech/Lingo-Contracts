const { describe } = require('mocha');
const { expect } = require('chai');
const { ethers } = require('hardhat');
const _ = require('lodash');

const { debitFee } = require('./utils');

const BN = ethers.BigNumber.from;

const { NAME, SYMBOL, TOTAL_SUPPLY, DECIMALS, FEE, ZERO_ADDRESS } = require('./config/index.js');

describe('LINGO Token', () => {
  let owner, user1, user2, user3, treasuryWallet;
  let token;
  const TOTAL_SUPPLY_BN = BN(TOTAL_SUPPLY);
  const DECIMALS_BN = BN(DECIMALS);
  const TOTAL_SUPPLY_BN_WEI = TOTAL_SUPPLY_BN.mul(BN(10).pow(DECIMALS_BN));
  const FEE_BN = BN(FEE);

  beforeEach(async () => {
    [owner, user1, user2, user3, treasuryWallet] = await ethers.getSigners();

    const Token = await ethers.getContractFactory('LINGO');
    token = await Token.deploy(
      NAME,
      SYMBOL,
      TOTAL_SUPPLY_BN,
      owner.address,
      treasuryWallet.address,
      FEE_BN
    );
  });

  describe('Deployment', async () => {
    it('Ownership transferred from deployer to owner', async () => {
      const result = await token.owner();
      expect(result).to.equal(owner.address);
    });
  });

  describe('Metadata', () => {
    it('Token metadata is correct', async () => {
      expect(await token.name()).to.equal(NAME);
      expect(await token.symbol()).to.equal(SYMBOL);
      expect(await token.decimals()).to.equals(Number(DECIMALS_BN));
      expect((await token.getTransferFee()).eq(FEE_BN)).is.true;
    });
  });

  describe('Balance', () => {
    it('Users can check their balance', async () => {
      expect((await token.balanceOf(user1.address)).eq(BN(0))).is.true;

      const amountToSendBN = BN(100).mul(BN(10).pow(DECIMALS_BN));
      //admin to user1.address
      await token.transfer(user1.address, amountToSendBN);
      expect((await token.balanceOf(user1.address)).eq(amountToSendBN)).is.true;
    });
  });

  describe('Transfer', () => {
    it('Initial supply minted and transferred to owner', async () => {
      expect((await token.balanceOf(owner.address)).eq(TOTAL_SUPPLY_BN_WEI)).is.true;
    });

    it('Users can transfer tokens to other users', async () => {
      const amountToSendBN = BN(100).mul(BN(10).pow(DECIMALS_BN));

      //admin to user1.address
      await token.transfer(user1.address, amountToSendBN);
      expect((await token.balanceOf(user1.address)).eq(amountToSendBN)).is.true;

      //user1.address to user2.address
      await token.connect(user1).transfer(user2.address, amountToSendBN);
      const expectedBalanceOfUser2 = await debitFee(token, amountToSendBN);
      expect((await token.balanceOf(user2.address)).eq(expectedBalanceOfUser2)).is.true;
    });

    it('Event emitted when tokens are transferred', async () => {
      const amountToSendBN = BN(100).mul(BN(10).pow(DECIMALS_BN));
      await expect(token.transfer(user1.address, amountToSendBN))
        .to.emit(token, 'Transfer')
        .withArgs(owner.address, user1.address, amountToSendBN);
    });

    it('Reverts if user tries to transfer tokens without enough balance', async () => {
      const amountToSendBN = BN(100).mul(BN(10).pow(DECIMALS_BN));
      await expect(
        token.connect(user3).transfer(user2.address, amountToSendBN)
      ).to.be.revertedWith('ERC20: transfer amount exceeds balance');
    });

    it('Reverts if user tries to transfer tokens to zero address', async () => {
      const amountToSendBN = BN(10).mul(BN(10).pow(DECIMALS_BN));
      await expect(token.transfer(ZERO_ADDRESS, amountToSendBN)).to.be.revertedWith(
        'ERC20: transfer to the zero address'
      );
    });
  });

  describe('Allowance', () => {
    it('Users can check their allowance', async () => {
      expect((await token.allowance(owner.address, user1.address)).eq(BN(0)));

      const amountToSendBN = BN(1000).mul(BN(10).pow(DECIMALS_BN));
      //approving allowance
      await token.approve(user1.address, amountToSendBN);
      //checking allowance
      expect((await token.allowance(owner.address, user1.address)).eq(amountToSendBN));
    });

    it('Approve transfer of available tokens by third-party', async () => {
      const amountToSendBN = BN(1000).mul(BN(10).pow(DECIMALS_BN));
      const balanceOfOwner = await token.balanceOf(owner.address);
      const balanceOfUser1 = await token.balanceOf(user1.address);
      const balanceOfUser2 = await token.balanceOf(user2.address);
      //approving allowance
      await token.approve(user1.address, amountToSendBN);
      //checking allowance

      expect((await token.allowance(owner.address, user1.address)).eq(amountToSendBN));
      //verifying transaction of approved tokens
      await token.connect(user1).transferFrom(owner.address, user2.address, amountToSendBN);

      expect((await token.balanceOf(owner.address)).eq(balanceOfOwner.sub(amountToSendBN)));

      expect((await token.balanceOf(user1.address)).eq(balanceOfUser1));

      expect((await token.balanceOf(user2.address)).eq(balanceOfUser2.add(amountToSendBN)));
    });

    it('Event emitted someone approves transfer of available tokens by third-party', async () => {
      const amountToSendBN = BN(1000).mul(BN(10).pow(DECIMALS_BN));

      await expect(token.approve(user1.address, amountToSendBN))
        .to.emit(token, 'Approval')
        .withArgs(owner.address, user1.address, amountToSendBN);
    });

    it('Increase allowance', async () => {
      const amountToSendBN = BN(1000).mul(BN(10).pow(DECIMALS_BN));
      const increasedAmountBN = BN(500).mul(BN(10).pow(DECIMALS_BN));
      await token.approve(user1.address, amountToSendBN);
      expect((await token.allowance(owner.address, user1.address)).eq(amountToSendBN));
      await token.increaseAllowance(user1.address, increasedAmountBN);
      expect(
        (await token.allowance(owner.address, user1.address)).eq(
          amountToSendBN.add(increasedAmountBN)
        )
      );
    });

    it('Decrease allowance', async () => {
      const amountToSendBN = BN(1000).mul(BN(10).pow(DECIMALS_BN));
      const increasedAmountBN = BN(500).mul(BN(10).pow(DECIMALS_BN));
      await token.approve(user1.address, amountToSendBN);
      expect((await token.allowance(owner.address, user1.address)).eq(amountToSendBN));
      await token.increaseAllowance(user1.address, increasedAmountBN);
      expect(
        (await token.allowance(owner.address, user1.address)).eq(
          amountToSendBN.sub(increasedAmountBN)
        )
      );
    });

    it('Revert when trying to approve unavailable tokens by third-party', async () => {
      const amountToSendBN = BN(1000).mul(BN(10).pow(DECIMALS_BN));
      //approving allowance
      await token.connect(user1).approve(user2.address, amountToSendBN);
      //checking allowance
      expect((await token.allowance(user1.address, user2.address)).eq(amountToSendBN));
      //verifying transaction of approved tokens
      await expect(
        token.connect(user2).transferFrom(user1.address, user3.address, amountToSendBN)
      ).to.be.revertedWith('ERC20: transfer amount exceeds balance');
    });

    it('Revert when trying to transfer more than allowed tokens by third-party', async () => {
      const amountToSendBN = BN(1000).mul(BN(10).pow(DECIMALS_BN));
      //approving allowance
      await token.approve(user1.address, amountToSendBN);
      //checking allowance
      expect((await token.allowance(owner.address, user1.address)).eq(amountToSendBN));
      //verifying transaction of approved tokens
      await expect(
        token
          .connect(user1)
          .transferFrom(owner.address, user2.address, amountToSendBN.add(BN(1000)))
      ).to.be.revertedWith('ERC20: insufficient allowance');
    });
  });

  describe('Ownership', () => {
    it('Transferring ownership', async () => {
      await token.transferOwnership(user1.address);
      expect(await token.owner()).to.equal(user1.address);
    });

    it('Event emitted on transferring ownership', async () => {
      await expect(token.transferOwnership(user1.address))
        .to.emit(token, 'OwnershipTransferred')
        .withArgs(owner.address, user1.address);
    });

    it('Revert when some user other than owner tries to transfer ownership', async () => {
      await expect(token.connect(user2).transferOwnership(user1.address)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
    });

    it('Renounce ownership', async () => {
      await token.renounceOwnership();
      expect(await token.owner()).to.not.equal(owner.address);
    });

    it('Revert when some user other than owner tries to renounce ownership', async () => {
      await expect(token.connect(user2).renounceOwnership()).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
    });
  });

  describe('Mint', () => {
    it('Owner can mint tokens', async () => {
      const amountToMintBN = BN(500).mul(BN(10).pow(DECIMALS_BN));
      const ownerInitBalanceBN = await token.balanceOf(owner.address);

      await token.mint(owner.address, amountToMintBN);
      expect((await token.balanceOf(owner.address)).eq(ownerInitBalanceBN.add(amountToMintBN))).is
        .true;
    });

    it('Reverts when non owner tries to mint tokens', async () => {
      const amountToMintBN = BN(500).mul(BN(10).pow(DECIMALS_BN));
      await expect(token.connect(user1).mint(owner.address, amountToMintBN)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
    });
  });

  describe('Burn', () => {
    it('Users can burn their own tokens', async () => {
      const amountToBurnBN = BN(500).mul(BN(10).pow(DECIMALS_BN));
      const ownerInitBalanceBN = await token.balanceOf(owner.address);

      await token.burn(amountToBurnBN);
      expect((await token.balanceOf(owner.address)).eq(ownerInitBalanceBN.sub(amountToBurnBN))).is
        .true;
    });

    it('Reverts when users tries to burn unavailable tokens', async () => {
      const amountToBurnBN = BN(500).mul(BN(10).pow(DECIMALS_BN));
      await expect(token.connect(user1).burn(amountToBurnBN)).to.be.revertedWith(
        'ERC20: burn amount exceeds balance'
      );
    });

    it('Users can burn allowed tokens from another user', async () => {
      const allowanceAmountBN = BN(1000).mul(BN(10).pow(DECIMALS_BN));
      const amountToBurnBN = BN(500).mul(BN(10).pow(DECIMALS_BN));
      const ownerInitBalanceBN = await token.balanceOf(owner.address);
      await token.approve(user1.address, allowanceAmountBN);
      expect((await token.allowance(owner.address, user1.address)).eq(allowanceAmountBN));
      await token.connect(user1).burnFrom(owner.address, amountToBurnBN);
      expect((await token.balanceOf(owner.address)).eq(ownerInitBalanceBN.sub(amountToBurnBN))).is
        .true;
      expect(
        (await token.allowance(owner.address, user1.address)).eq(
          allowanceAmountBN.sub(amountToBurnBN)
        )
      );
    });

    it('Reverts when users tries to burn tokens more than allowed', async () => {
      const allowanceAmountBN = BN(500).mul(BN(10).pow(DECIMALS_BN));
      const amountToBurnBN = BN(1000).mul(BN(10).pow(DECIMALS_BN));
      await token.approve(user1.address, allowanceAmountBN);
      expect((await token.allowance(owner.address, user1.address)).eq(allowanceAmountBN));
      await expect(
        token.connect(user1).burnFrom(owner.address, amountToBurnBN)
      ).to.be.revertedWith('ERC20: insufficient allowance');
    });
  });

  describe('Transaction Fee', () => {
    it('Anyone can read current fee percentage', async () => {
      expect((await token.getTransferFee()).eq(FEE_BN)).is.true;
    });

    it('Owner can update fee percentage', async () => {
      expect((await token.getTransferFee()).eq(FEE_BN)).is.true;

      const NEW_FEE = BN(200);
      await token.setTransferFee(NEW_FEE);

      expect((await token.getTransferFee()).eq(NEW_FEE)).is.true;
    });

    it('Event emitted when fee percentage updated', async () => {
      const NEW_FEE = BN(200);
      await expect(token.setTransferFee(NEW_FEE))
        .to.emit(token, 'TransferFeeUpdated')
        .withArgs(NEW_FEE);
    });

    it('Reverts when non owner tries to update fee percentage', async () => {
      const NEW_FEE = BN(200);

      await expect(token.connect(user1).setTransferFee(NEW_FEE)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
    });

    it('Reverts when tries to update fee percentage outside the limit 0% - 5%', async () => {
      const NEW_FEE = BN(600);

      await expect(token.setTransferFee(NEW_FEE)).to.be.revertedWith(
        'LINGO: Transfer Fee should be between 0% - 5%'
      );
    });
  });

  describe('Treasury Wallet', () => {
    it('Owner can read current treasury wallet', async () => {
      expect(await token.getTreasuryWalletAddress()).equals(treasuryWallet.address);
    });

    it('Owner can update treasury wallet', async () => {
      await token.setTreasuryWalletAddress(user3.address);
      expect(await token.getTreasuryWalletAddress()).equals(user3.address);
    });

    it('Event emitted when treasury wallet updated', async () => {
      await expect(token.setTreasuryWalletAddress(user3.address))
        .to.emit(token, 'TreasuryWalletUpdated')
        .withArgs(user3.address);
    });

    it('Fee is debited and sent to treasury wallet on transactions', async () => {
      const amountToSendBN = BN(100).mul(BN(10).pow(DECIMALS_BN));

      expect((await token.balanceOf(treasuryWallet.address)).eq(BN(0))).is.true;

      //admin to user1.address
      await token.transfer(user1.address, amountToSendBN);
      expect((await token.balanceOf(user1.address)).eq(amountToSendBN)).is.true;

      //user1.address to user2.address
      await token.connect(user1).transfer(user2.address, amountToSendBN);
      const expectedBalanceOfUser2 = await debitFee(token, amountToSendBN);
      expect((await token.balanceOf(user2.address)).eq(expectedBalanceOfUser2)).is.true;

      const fee = amountToSendBN.sub(expectedBalanceOfUser2);
      expect((await token.balanceOf(treasuryWallet.address)).eq(fee)).is.true;
    });

    it('Reverts when non owner tries to update treasury wallet', async () => {
      await expect(
        token.connect(user1).setTreasuryWalletAddress(user3.address)
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('Reverts when owner tries to update treasury wallet with zero address  `', async () => {
      await expect(token.setTreasuryWalletAddress(ZERO_ADDRESS)).to.be.revertedWith(
        'LINGO: Zero Address'
      );
    });
  });

  describe('Whitelisting', () => {
    it('Owner address, Contract address and Treasury wallet address are included in internal whitelist by default', async () => {
      expect(await token.isInternalWhiteListed(owner.address)).to.be.true;
      expect(await token.isInternalWhiteListed(token.address)).to.be.true;
      expect(await token.isInternalWhiteListed(treasuryWallet.address)).to.be.true;
    });

    it('Owner can add accounts to both whitelists', async () => {
      expect(await token.isExternalWhiteListed(user1.address)).to.be.false;
      await token.addToWhiteList(0, [user1.address]);
      expect(await token.isExternalWhiteListed(user1.address)).to.be.true;

      expect(await token.isInternalWhiteListed(user1.address)).to.be.false;
      await token.addToWhiteList(1, [user1.address]);
      expect(await token.isInternalWhiteListed(user1.address)).to.be.true;
    });

    it('Owner can remove accounts from whitelists', async () => {
      await token.addToWhiteList(0, [user1.address]);
      expect(await token.isExternalWhiteListed(user1.address)).to.be.true;
      await token.removeFromWhiteList(0, [user1.address]);
      expect(await token.isExternalWhiteListed(user1.address)).to.be.false;

      await token.addToWhiteList(1, [user1.address]);
      expect(await token.isInternalWhiteListed(user1.address)).to.be.true;
      await token.removeFromWhiteList(1, [user1.address]);
      expect(await token.isInternalWhiteListed(user1.address)).to.be.false;
    });

    it('Users can check an account is whitelisted or not', async () => {
      expect(await token.isExternalWhiteListed(user1.address)).to.be.false;
      await token.addToWhiteList(0, [user1.address]);
      expect(await token.isExternalWhiteListed(user1.address)).to.be.true;

      expect(await token.isInternalWhiteListed(user1.address)).to.be.false;
      await token.addToWhiteList(1, [user1.address]);
      expect(await token.isInternalWhiteListed(user1.address)).to.be.true;
    });

    it('Users can read whitelisted accounts', async () => {
      expect(await token.isExternalWhiteListed(user1.address)).to.be.false;
      await token.addToWhiteList(0, [user1.address]);
      const externalWhiteList = await token.getExternalWhitelistedAddresses();
      expect(_.isEqual(externalWhiteList, [user1.address])).to.be.true;

      expect(await token.isInternalWhiteListed(user1.address)).to.be.false;
      await token.addToWhiteList(1, [user1.address]);
      const internalWhiteList = await token.getInternalWhitelistedAddresses();
      expect(
        _.isEqual(internalWhiteList, [
          owner.address,
          token.address,
          treasuryWallet.address,
          user1.address,
        ])
      ).to.be.true;
    });

    it('Fee is not debited if token transferred from or to an internal whitelisted account', async () => {
      const amountToSendBN = BN(10).mul(BN(10).pow(DECIMALS_BN));

      expect(await token.isInternalWhiteListed(owner.address)).to.be.true;

      //From internal whitelisted account
      await expect(token.transfer(user1.address, amountToSendBN))
        .to.emit(token, 'Transfer')
        .withArgs(owner.address, user1.address, amountToSendBN);

      expect((await token.balanceOf(user1.address)).eq(amountToSendBN)).is.true;

      //To internal whitelisted account
      const balanceOfOwner = await token.balanceOf(owner.address);
      await expect(token.connect(user1).transfer(owner.address, amountToSendBN))
        .to.emit(token, 'Transfer')
        .withArgs(user1.address, owner.address, amountToSendBN);

      expect((await token.balanceOf(owner.address)).eq(balanceOfOwner.add(amountToSendBN))).is
        .true;
    });

    it('Fee is not debited if token transferred to an external whitelisted account', async () => {
      const amountToSendBN = BN(10).mul(BN(10).pow(DECIMALS_BN));

      await token.addToWhiteList(0, [user2.address]);
      expect(await token.isInternalWhiteListed(user1.address)).to.be.false;
      expect(await token.isInternalWhiteListed(user2.address)).to.be.false;
      expect(await token.isExternalWhiteListed(user1.address)).to.be.false;
      expect(await token.isExternalWhiteListed(user2.address)).to.be.true;
      token.transfer(user1.address, amountToSendBN);

      //To external whitelisted account
      await expect(token.connect(user1).transfer(user2.address, amountToSendBN))
        .to.emit(token, 'Transfer')
        .withArgs(user1.address, user2.address, amountToSendBN);

      expect((await token.balanceOf(user2.address)).eq(amountToSendBN)).is.true;
    });

    it('Fee is debited if token transferred from an external whitelisted account', async () => {
      const amountToSendBN = BN(10).mul(BN(10).pow(DECIMALS_BN));

      await token.addToWhiteList(0, [user1.address]);
      expect(await token.isInternalWhiteListed(user1.address)).to.be.false;
      expect(await token.isInternalWhiteListed(user2.address)).to.be.false;
      expect(await token.isExternalWhiteListed(user1.address)).to.be.true;
      expect(await token.isExternalWhiteListed(user2.address)).to.be.false;
      token.transfer(user1.address, amountToSendBN);

      //From external whitelisted account
      const expectedBalanceOfUser2 = await debitFee(token, amountToSendBN);
      await expect(token.connect(user1).transfer(user2.address, amountToSendBN))
        .to.emit(token, 'Transfer')
        .withArgs(user1.address, user2.address, expectedBalanceOfUser2);

      expect((await token.balanceOf(user2.address)).eq(expectedBalanceOfUser2)).is.true;
    });

    it('Fee is debited for all other transactions', async () => {
      const amountToSendBN = BN(10).mul(BN(10).pow(DECIMALS_BN));

      expect(await token.isInternalWhiteListed(user1.address)).to.be.false;
      expect(await token.isInternalWhiteListed(user2.address)).to.be.false;
      expect(await token.isExternalWhiteListed(user1.address)).to.be.false;
      expect(await token.isExternalWhiteListed(user2.address)).to.be.false;
      token.transfer(user1.address, amountToSendBN);

      //From external whitelisted account
      const expectedBalanceOfUser2 = await debitFee(token, amountToSendBN);
      await expect(token.connect(user1).transfer(user2.address, amountToSendBN))
        .to.emit(token, 'Transfer')
        .withArgs(user1.address, user2.address, expectedBalanceOfUser2);

      expect((await token.balanceOf(user2.address)).eq(expectedBalanceOfUser2)).is.true;
    });
  });
});
