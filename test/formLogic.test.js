import { describe, it, expect } from 'vitest';
import { Workbench } from '../src/components/Workbench.jsx';

describe('Workbench privacy posture', () => {
  it('does not persist node input to localStorage', () => {
    const source = Workbench.toString();
    expect(source).toContain('nodeInput');
    expect(source).not.toContain("localStorage.setItem('inputTextarea'");
    expect(source).not.toContain('localStorage.setItem("inputTextarea"');
    expect(source).not.toContain("localStorage.setItem('nodeInput'");
    expect(source).not.toContain('localStorage.setItem("nodeInput"');
  });
});
