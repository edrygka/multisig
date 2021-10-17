const chai = require('chai');
const expect = chai.expect;
const { ethers } = require('hardhat');
require('@nomiclabs/hardhat-web3');

describe('MultiSig', () => {
  let multiSig;
  let accounts;
  let owners;

  before(async () => {
    accounts = await ethers.getSigners();
    owners = accounts.slice(0, 3).map(acc => acc.address);
    const MultiSigContract = await ethers.getContractFactory('MultiSigWallet');
    multiSig = await MultiSigContract.deploy(owners, 2);
    await multiSig.deployed();
  });

  describe('getRequiredConfirmations', () => {
    it('should return required confirmation', async () => {
      expect(await multiSig.getRequiredConfirmations()).to.eq(2);
    });
  });

  describe('getOwners', () => {
    it('should return right addresses', async () => {
      expect(await multiSig.getOwners()).to.eql(owners);
    });
  });

  describe('payable', () => {
    it('should receive ethers on contract address and emit Deposit event', async () => {
      const from = accounts[3].address;
      const signer = await ethers.getSigner(from);
      const value = ethers.utils.parseEther('10'); // 10 ether
      await expect(signer.sendTransaction({
        to: multiSig.address,
        value
      }))
        .to.emit(multiSig, 'Deposit')
        .withArgs(from, value, value);
    });
  });

  describe('submitTransaction', () => {
    it('should create transaction structure', async () => {
      const to = accounts[4].address;
      const value = ethers.utils.parseEther('2'); // 2 ethers
      const data = web3.utils.fromAscii('hello bitches');

      await expect(multiSig.submitTransaction(to, value, data))
        .to.emit(multiSig, 'SubmitTransaction')
        .withArgs(owners[0], 0, to, value, data);

      // check transaction exists
      const bcData = await multiSig.getTransactionCount();
      expect(bcData).to.eq(1);
    });

    it('should revert call to function if caller is not an owner', async () => {
      const to = accounts[4].address;
      const value = ethers.utils.parseEther('2'); // 2 ethers
      const data = web3.utils.fromAscii('bitches, wrong transaction!');

      await expect(multiSig.connect(accounts[3]).submitTransaction(to, value, data))
        .to.be.revertedWith('not owner');
    });
  });

  describe('confirmTransaction', () => {
    it('should confirm transaction', async () => {
      const txIndex = 0;

      await expect(multiSig.confirmTransaction(txIndex))
        .to.emit(multiSig, 'ConfirmTransaction')
        .withArgs(owners[0], txIndex);

      // check transaction got confirmation
      const bcData = await multiSig.getTransaction(txIndex);
      expect(bcData).to.eql([
        accounts[4].address,
        ethers.utils.parseEther('2'),
        web3.utils.fromAscii('hello bitches'),
        false,
        ethers.BigNumber.from('1') // num of confirmations
      ]);
    });

    it('should revert call to function if caller is not an owner', async () => {
      const txIndex = 0;

      await expect(multiSig.connect(accounts[3]).confirmTransaction(txIndex))
        .to.be.revertedWith('not owner');
    });

    it('should revert call to function if tx index does not exist', async () => {
      const txIndex = 5;

      await expect(multiSig.confirmTransaction(txIndex))
        .to.be.revertedWith('tx does not exist');
    });

    it('should revert call to function if tx already executed', async () => {
      const txIndex = 1;

      // submit tx, confirm it and execute to reach notExecuted modifier
      const to = accounts[6].address;
      const value = ethers.utils.parseEther('3'); // 3 ethers
      const data = web3.utils.fromAscii('hello bitches, its me again');

      await multiSig.submitTransaction(to, value, data);
      await multiSig.confirmTransaction(txIndex);
      await multiSig.connect(accounts[1]).confirmTransaction(txIndex);
      await multiSig.executeTransaction(txIndex);

      await expect(multiSig.confirmTransaction(txIndex))
        .to.be.revertedWith('tx already executed');
    });

    it('should revert call to function if tx already confirmed', async () => {
      const txIndex = 0;

      await expect(multiSig.confirmTransaction(txIndex))
        .to.be.revertedWith('tx already confirmed');
    });
  });

  describe('executeTransaction', () => {
    it('should reject execution if not enough confirmations', async () => {
      // transaction with one confirmation
      const txIndex = 0;

      await expect(multiSig.executeTransaction(txIndex))
        .to.be.revertedWith('not enough confirmations');
    });

    it('should reject execution if caller is not owner', async () => {
      const txIndex = 0;

      await expect(multiSig.connect(accounts[3]).executeTransaction(txIndex))
        .to.be.revertedWith('not owner');
    });

    it('should reject execution if tx does not exist', async () => {
      const txIndex = 5;

      await expect(multiSig.executeTransaction(txIndex))
        .to.be.revertedWith('tx does not exist');
    });

    it('should execute tx successfully if got 2 confirmations', async () => {
      // transaction with one confirmation
      const txIndex = 0;

      // add one more confirmation
      await multiSig.connect(accounts[1]).confirmTransaction(txIndex);

      await expect(multiSig.executeTransaction(txIndex))
        .to.emit(multiSig, 'ExecuteTransaction')
        .withArgs(owners[0], txIndex);
    });

    it('should reject execution if tx already executed', async () => {
      const txIndex = 0;

      await expect(multiSig.executeTransaction(txIndex))
        .to.be.revertedWith('tx already executed');
    });

    it('should reject execution if not enough ethers on balance', async () => {
      // submit tx, confirm it and execute to get rejection
      const to = accounts[6].address;
      const value = ethers.utils.parseEther('100'); // 100 ethers(we got only 10 on balance)
      const data = web3.utils.fromAscii('hello bitches, I am rich');
      const txIndex = 2;

      await multiSig.submitTransaction(to, value, data);
      await multiSig.confirmTransaction(txIndex);
      await multiSig.connect(accounts[1]).confirmTransaction(txIndex);

      await expect(multiSig.executeTransaction(txIndex))
        .to.be.revertedWith('tx failed');
    });
  });

  describe('revokeConfirmation', () => {
    it('should reject execution if caller is not owner', async () => {
      const txIndex = 0;

      await expect(multiSig.connect(accounts[3]).revokeConfirmation(txIndex))
        .to.be.revertedWith('not owner');
    });

    it('should reject execution if tx does not exist', async () => {
      const txIndex = 5;

      await expect(multiSig.revokeConfirmation(txIndex))
        .to.be.revertedWith('tx does not exist');
    });

    it('should reject execution if tx already executed', async () => {
      const txIndex = 0;

      await expect(multiSig.revokeConfirmation(txIndex))
        .to.be.revertedWith('tx already executed');
    });

    it('should revoke tx successfully', async () => {
      // get transaction from previous test suit
      const txIndex = 2;

      await expect(multiSig.revokeConfirmation(txIndex))
        .to.emit(multiSig, 'RevokeConfirmation')
        .withArgs(owners[0], txIndex);

      const bcData = await multiSig.getTransaction(txIndex);
      expect(bcData).to.eql([
        accounts[6].address,
        ethers.utils.parseEther('100'),
        web3.utils.fromAscii('hello bitches, I am rich'),
        false,
        ethers.BigNumber.from('1') // should have only 1 confirmation
      ]);
    });
  });
});
