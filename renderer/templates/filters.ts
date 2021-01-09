import { FilterImpl } from 'liquidjs/dist/template/filter/filter-impl';
import {
  CodeAccessor,
  ImportFrom,
  RegistrationDescriptor
} from '../../generator/generatorContext';
import { getRelativePath } from '../../generator/utils';

function addImports(pathAccessor: CodeAccessor, importsByPath: Map<string, ImportFrom[]>) {
  if (!pathAccessor) {
    throw Error(`The path accessor argument is missing`);
  }

  if (pathAccessor.importDeclaration) {
    const importFrom = pathAccessor.importDeclaration.normalized;
    let pathImports = importsByPath.get(importFrom.path);
    if (!pathImports) {
      pathImports = [];
      importsByPath.set(importFrom.path, pathImports);
    }

    if (pathImports.findIndex(i => i.name === importFrom.name) === -1) {
      pathImports.push(importFrom);
    }
  }

  if (pathAccessor.child) {
    addImports(pathAccessor.child, importsByPath);
  }

  if (pathAccessor.typeNames) {
    pathAccessor.typeNames.forEach(t => addImports(t, importsByPath));
  }
}

export function getTypeName(pathAccessor: CodeAccessor, includeTypeArgs: boolean): string {
  if (!pathAccessor) {
    throw Error(`The path accessor argument is missing`);
  }

  let name: string = pathAccessor.name;
  if (pathAccessor.importDeclaration) {
    switch (pathAccessor.importDeclaration.from.kind) {
      case 'Named': {
        name = pathAccessor.importDeclaration.normalized.name;
        break;
      }

      case 'Namespace': {
        if (pathAccessor.child) {
          return getTypeName({
            importDeclaration: pathAccessor.importDeclaration,
            name: pathAccessor.child.name,
            child: pathAccessor.child.child,
            typeNames: pathAccessor.child.typeNames
          }, includeTypeArgs);
        }

        name = pathAccessor.importDeclaration.normalized.name;
        break;
      }
    }
  }

  if (includeTypeArgs && pathAccessor.typeNames) {
    const typeArgs = pathAccessor.typeNames.map(t => getTypeName(t, includeTypeArgs)).join(', ');
    if (typeArgs.length !== 0) {
      return `${name}<${typeArgs}>`;
    }
  }

  return name;
}

function getSymbolPathImpl(accessor: CodeAccessor): string {
  let typeNames: CodeAccessor[] | undefined;
  if (accessor.child) {
    typeNames = accessor.child.typeNames;
  }
  else {
    typeNames = accessor.typeNames;
  }

  const names: string[] = [getTypeName(accessor, false)];
  if (typeNames && typeNames.length !== 0) {
    names.push(typeNames.map(t => getSymbolPathImpl(t)).join('Of'));
  }

  return names.join('Of');
}

export function getImportsFilter(this: FilterImpl, registration: RegistrationDescriptor): ImportFrom[] {
  if (!registration) {
    throw Error(`The registration-argument is missing`);
  }

  const importsByPath = new Map<string, ImportFrom[]>();
  addImports(registration.service.accessor, importsByPath);
  if (registration.service.symbolDescriptor) {
    addImports(registration.service.symbolDescriptor!.accessor, importsByPath);
  }

  if (registration.instance) {
    addImports(registration.instance!.accessor, importsByPath);
    registration.instance!.constructorArgs.forEach(ctor => addImports(ctor.symbolDescriptor.accessor, importsByPath));
  }

  const result: ImportFrom[] = [];
  const pathIterator = importsByPath.keys();
  let nextPath = pathIterator.next();
  while(nextPath && !nextPath.done) {
    const importPath = nextPath.value;
    result.push(...importsByPath.get(importPath)!);
    nextPath = pathIterator.next();
  }

  return result;
}

export function getImportDeclarationFilter(this: FilterImpl, importFrom: ImportFrom, outputDir: string): string {
  if (!outputDir) {
    throw Error(`The code-file output directory is missing`);
  }

  const importPath = getRelativePath(outputDir, importFrom);
  switch (importFrom.kind) {
    case 'Default': {
      return `import ${importFrom.name} from '${importPath}';`
    }
    case 'Named': {
      if (importFrom.alias === importFrom.name) {
        return `import { ${importFrom.name} } from '${importPath}';`
      }

      return `import { ${importFrom.name} as ${importFrom.alias} } from '${importPath}';`
    }
    case 'Namespace': {
      return `import * as ${importFrom.alias} from '${importPath}';`
    }
  }

  throw Error(`The import-kind is not supported`);
}

export function getTypeNameFilter(this: FilterImpl, pathAccessor: CodeAccessor, includeTypeArgs: boolean): string {
  return getTypeName(pathAccessor, includeTypeArgs);
}
export function getSymbolPath(this: FilterImpl, symbolAccessor: CodeAccessor): string {
  if (!symbolAccessor) {
    throw new Error(`The symbol path accessor argument is missing`);
  }

  const names: string[] = ['__AutoGeneratedTypes'];
  names.push(getSymbolPathImpl(symbolAccessor));
  return names.join('.');
}