// Mock implementation of the 'inquirer' package
const inquirer = {
  prompt: jest.fn().mockResolvedValue({}),
  Separator: class Separator {
    constructor(public line?: string) {}
  }
};

export default inquirer;
