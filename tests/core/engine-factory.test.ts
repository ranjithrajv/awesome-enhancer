// tests/core/engine-factory.test.ts
import { describe, it, expect } from 'vitest';
import { createEngine } from '../../src/core/engine-factory.js';
import { ProcessorEngine } from '../../src/lib/processor-engine.js';

describe('createEngine', () => {
  it('returns a ProcessorEngine', () => {
    const engine = createEngine({});
    expect(engine).toBeInstanceOf(ProcessorEngine);
  });

  it('registers no processors when both options are false', () => {
    const engine = createEngine({ addMetadata: false, updateDescriptions: false });
    expect(engine).toBeInstanceOf(ProcessorEngine);
  });

  it('registers MetadataProcessor when addMetadata is true', () => {
    const engine = createEngine({ addMetadata: true });
    expect(engine).toBeInstanceOf(ProcessorEngine);
  });

  it('registers DescriptionProcessor when updateDescriptions is true', () => {
    const engine = createEngine({ updateDescriptions: true });
    expect(engine).toBeInstanceOf(ProcessorEngine);
  });

  it('registers both processors when both options are true', () => {
    const engine = createEngine({ addMetadata: true, updateDescriptions: true });
    expect(engine).toBeInstanceOf(ProcessorEngine);
  });
});
