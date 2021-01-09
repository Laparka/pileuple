import { ImportFrom, CodeAccessor, ImportDeclaration } from './generatorContext';
import path from 'path';

const ALPHA = ['a','b','c','d','e','f','g','h','i','j','k','l','m','n','o', 'p', 'q','r','s','t','u','v','w','x','y','z','A','B','C','D','E','F','G','H','I','J','K','L','M','N','O', 'P', 'Q','R','S','T','U','V','W','X','Y','Z','_'];
const NUMERIC = ['1','2','3','4','5','6','7','8','9','0'];

export function tokenizePropertyAccessor(propertyAccessor: CodeAccessor): string[] {
  if (!propertyAccessor) {
    return [];
  }

  if (propertyAccessor.name === '[]') {
    const children: string[] = [];
    if (propertyAccessor.child) {
      children.push(...tokenizePropertyAccessor(propertyAccessor.child));
    }

    children.push('[]');
    return children;
  }

  const result: string[] = [];
  result.push(propertyAccessor.name);
  if (propertyAccessor.child) {
    result.push(...tokenizePropertyAccessor(propertyAccessor.child));
  }

  if (propertyAccessor.typeNames && propertyAccessor.typeNames.length !== 0) {
    const genericDefinition = propertyAccessor.typeNames.map(t => tokenizePropertyAccessor(t)).join(',');
    result.push(`<${genericDefinition}>`);
  }

  return result;
}

export function assignAccessorImport(propertyAccessor: CodeAccessor, imports: ImportFrom[]): ImportDeclaration | null {
  if (!imports) {
    throw Error(`The imports collection is missing`);
  }

  if (!propertyAccessor || !propertyAccessor.name) {
    throw Error(`The property accessor instance name is missing`);
  }

  if (propertyAccessor.name === '[]') {
    if (propertyAccessor.child) {
      return assignAccessorImport(propertyAccessor.child, imports);
    }

    throw Error(`The array element type is not defined`);
  }

  const importFromIndex = imports.findIndex(i => i.alias === propertyAccessor.name);
  if (importFromIndex === -1) {
    return null;
  }

  const importDeclaration: ImportDeclaration = {
    from: imports[importFromIndex],
    normalized: normalizeImport(propertyAccessor, imports[importFromIndex])
  };

  propertyAccessor.importDeclaration = importDeclaration;
  if (propertyAccessor.typeNames && propertyAccessor.typeNames.length !== 0) {
    propertyAccessor.typeNames.forEach(t => assignAccessorImport(t, imports));
  }

  return importDeclaration;
}

export function isSameType(expected: CodeAccessor, actual: CodeAccessor): boolean {
  if (expected.name === '[]') {
    if (expected.child) {
      return isSameType(expected.child, actual);
    }

    return false;
  }

  if (actual.name === '[]') {
    if (actual.child) {
      return isSameType(expected, actual.child);
    }

    return false;
  }

  let isRootEq: boolean;
  if (expected.importDeclaration) {
    if (actual.importDeclaration) {
      isRootEq = JSON.stringify(expected.importDeclaration.normalized) === JSON.stringify(actual.importDeclaration.normalized);
    }
    else {
      isRootEq = false;
    }
  }
  else {
    isRootEq = !actual.importDeclaration && expected.name === actual.name;
  }

  if (!isRootEq) {
    return false;
  }

  let isChildEq: boolean;
  if (expected.child) {
    if (actual.child) {
      isChildEq = isSameType(expected.child, actual.child);
    }
    else {
      isChildEq = false;
    }
  }
  else {
    isChildEq = !actual.child;
  }

  if (!isChildEq) {
    return false;
  }

  let areTypeArgsEq = true;
  if (expected.typeNames) {
    if (actual.typeNames) {
      areTypeArgsEq = expected.typeNames.length === actual.typeNames.length;
      if (areTypeArgsEq) {
        expected.typeNames.forEach((t, i) => {
          if (!isSameType(t, actual.typeNames![i])) {
            areTypeArgsEq = false;
          }
        });
      }
    }
    else {
      areTypeArgsEq = false;
    }
  }
  else {
    areTypeArgsEq = !actual.typeNames;
  }

  return areTypeArgsEq;
}

export function toNamespace(importPath: string): string {
  const result: string[] = [];
  for(const ch of importPath) {
    if (ALPHA.findIndex(_ => _ === ch) >= 0 || NUMERIC.findIndex(_ => _ === ch) >= 0) {
      result.push(ch);
    }
  }

  if (result.length === 0 || result[0] !== '_') {
    return '_' + result.join('');
  }

  return result.join('');
}

export function getFullPath(basePath: string, relativePath: string): string {
  return path.join(basePath, relativePath).replace(/[\\]/g, '/');
}

export function getRelativePath(outputDir: string, importFrom: ImportFrom): string {
  if (!importFrom.isExternal) {
    const relativePath = path.relative(outputDir, importFrom.path).replace(/[\\]/g, '/');
    return `./${relativePath}`;
  }

  return importFrom.path;
}

export function normalizeImport(pathAccessor: CodeAccessor, importFrom: ImportFrom): ImportFrom {
  /*
  * import Logger from './';
  * import {Logger as Shlogger} from './';
  * import * as S from './';
  * const a: S.Logger = {};
  * const b: Shlogger = {};
  * const c: Logger = {};
  */
  const clone: ImportFrom = JSON.parse(JSON.stringify(importFrom));

  switch (clone.kind) {
    case 'Namespace': {
      clone.kind = 'Named';
      clone.name = pathAccessor.child!.name;
      clone.alias = clone.name;
      break;
    }
    case 'Named': {
      clone.alias = clone.name;
      clone.kind = 'Named';
      break;
    }
  }

  return clone;
}
