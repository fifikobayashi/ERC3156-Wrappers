const AToken = artifacts.require('ATokenMock')
const ERC20Mock = artifacts.require('ERC20Mock')
const LendingPoolAddressesProvider = artifacts.require('LendingPoolAddressesProviderMock')
const LendingPool = artifacts.require('LendingPoolMock')
const AaveERC3156 = artifacts.require('AaveERC3156')
const FlashBorrower = artifacts.require('FlashBorrower')

const { BN, expectRevert } = require('@openzeppelin/test-helpers')
require('chai').use(require('chai-as-promised')).should()

contract('AaveERC3156', (accounts) => {
  const [deployer, user1] = accounts
  let weth, dai, aWeth, aDai, lendingPool, lendingPoolAddressProvider, lender
  let borrower
  const aaveBalance = new BN(100000);

  beforeEach(async () => {
    weth = await ERC20Mock.new("WETH", "WETH")
    dai = await ERC20Mock.new("DAI", "DAI")
    aWeth = await AToken.new(weth.address, "AToken1", "ATST1")
    aDai = await AToken.new(dai.address, "Atoken2", "ATST2")
    lendingPool = await LendingPool.new({ from: deployer })
    await lendingPool.addReserve(aWeth.address)
    await lendingPool.addReserve(aDai.address)
    lendingPoolAddressProvider = await LendingPoolAddressesProvider.new(lendingPool.address)
    lender = await AaveERC3156.new(lendingPoolAddressProvider.address)

    borrower = await FlashBorrower.new()

    await weth.mint(aWeth.address, aaveBalance)
    await dai.mint(aDai.address, aaveBalance)
  })

  it('flash supply', async function () {
    expect(await lender.maxFlashLoan(weth.address)).to.be.bignumber.equal(aaveBalance);
    expect(await lender.maxFlashLoan(dai.address)).to.be.bignumber.equal(aaveBalance);
    expect(await lender.maxFlashLoan(lender.address)).to.be.bignumber.equal("0");
  });

  it('flash fee', async function () {
    expect(await lender.flashFee(weth.address, aaveBalance)).to.be.bignumber.equal(aaveBalance.muln(9).divn(10000));
    expect(await lender.flashFee(dai.address, aaveBalance)).to.be.bignumber.equal(aaveBalance.muln(9).divn(10000));
    await expectRevert(
      lender.flashFee(lender.address, aaveBalance),
      "Unsupported currency"
    )
  });

  it('weth flash loan', async () => {
    const fee = await lender.flashFee(weth.address, aaveBalance)

    await weth.mint(borrower.address, fee, { from: user1 })
    await borrower.flashBorrow(lender.address, weth.address, aaveBalance, { from: user1 })

    const balanceAfter = await weth.balanceOf(user1)
    balanceAfter.toString().should.equal(new BN('0').toString())
    const flashBalance = await borrower.flashBalance()
    flashBalance.toString().should.equal(aaveBalance.add(fee).toString())
    const flashToken = await borrower.flashToken()
    flashToken.toString().should.equal(weth.address)
    const flashAmount = await borrower.flashAmount()
    flashAmount.toString().should.equal(aaveBalance.toString())
    const flashFee = await borrower.flashFee()
    flashFee.toString().should.equal(fee.toString())
    const flashSender = await borrower.flashSender()
    flashSender.toString().should.equal(borrower.address)
  })

  it('dai flash loan', async () => {
    const fee = await lender.flashFee(dai.address, aaveBalance)

    await dai.mint(borrower.address, fee, { from: user1 })
    await borrower.flashBorrow(lender.address, dai.address, aaveBalance, { from: user1 })

    const balanceAfter = await dai.balanceOf(user1)
    balanceAfter.toString().should.equal(new BN('0').toString())
    const flashBalance = await borrower.flashBalance()
    flashBalance.toString().should.equal(aaveBalance.add(fee).toString())
    const flashToken = await borrower.flashToken()
    flashToken.toString().should.equal(dai.address)
    const flashAmount = await borrower.flashAmount()
    flashAmount.toString().should.equal(aaveBalance.toString())
    const flashFee = await borrower.flashFee()
    flashFee.toString().should.equal(fee.toString())
    const flashSender = await borrower.flashSender()
    flashSender.toString().should.equal(borrower.address)
  })
})
