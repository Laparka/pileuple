import { createSourceFile, ScriptTarget, SourceFile, Node } from 'typescript';
import * as path from 'path';
import { existsSync, readFileSync } from 'fs';
import { NodeVisitor } from './visitors/nodeVisitor';
import AnyNodeVisitor from './visitors/anyNodeVisitor';
import { CodeAccessor, ConstructorArgumentDescriptor, ImportFrom, RegistrationDescriptor } from './generatorContext';
import { addUsedImports, getLastPropertyAccessor } from './utils';

export default class RegistrationsParser {
  private readonly _visitor: NodeVisitor;

  constructor() {
    this._visitor = new AnyNodeVisitor();
  }

  parse(registrationFilePath: string, className: string): RegistrationDescriptor[] {
    const registrations: RegistrationDescriptor[] = [];
    const imports: ImportFrom[] = [];
    this._visitor.visit(RegistrationsParser.getSyntax(registrationFilePath), {
      modulePath: registrationFilePath,
      instanceName: className,
      mode: 'Module',
      registrations: registrations,
      imports: imports
    });

    this.fillDependencies(registrations, imports);
    return registrations;
  }

  private fillDependencies(registrations: RegistrationDescriptor[], imports: ImportFrom[]): void {
    for(const registration of registrations) {
      registration.includeAutoGeneratedSymbols = !!registration.service.symbolDescriptor?.autoGenerated;
      if (!registration.instance || !registration.instance.importFrom) {
        continue;
      }

      const filePath = `${registration.instance.importFrom.path}.ts`;
      if (!existsSync(path.normalize(filePath))) {
        throw Error(`Package instances are not supported yet`);
      }

      const dependencies: RegistrationDescriptor[] = [];
      this._visitor.visit(RegistrationsParser.getSyntax(filePath), {
        modulePath: filePath,
        instanceName: getLastPropertyAccessor(registration.instance.accessor),
        mode: 'Dependent',
        registrations: dependencies,
        imports: imports
      });

      if (dependencies.length === 0) {
        continue;
      }

      dependencies.forEach(ctorArg => {
        const ctorServiceIndex = registrations.findIndex(r => r.service.displayName === ctorArg.service.displayName);
        if (ctorServiceIndex >= 0) {
          const ctorService = registrations[ctorServiceIndex];
          const ctorArgDescriptor: ConstructorArgumentDescriptor = {
            isCollection: ctorArg.service.accessor.name === '[]',
            symbolDescriptor: ctorService.service.symbolDescriptor
          };

          if(ctorService.service.symbolDescriptor.autoGenerated) {
            registration.includeAutoGeneratedSymbols = true;
          }
          else {
            const importNode: CodeAccessor = {
              name: ctorService.service.symbolDescriptor.symbolNamespace,
              child: {
                name: ctorService.service.symbolDescriptor.symbolId
              }
            };

            addUsedImports(importNode, ctorService.imports!, registration.imports!);
          }

          registration.instance!.constructorArgs.push(ctorArgDescriptor);
        }
        else {
          throw Error(`Can't find the instance ${registration.instance?.displayName} dependency registration for ${ctorArg.service.displayName} type`)
        }
      });
    }
  }

  private static getSyntax(filePath: string): Node {
    if (!existsSync(path.normalize(filePath))) {
      throw Error(`File ${filePath} was not found`);
    }

    const fileContent = readFileSync(filePath, { encoding: "utf8" });
    const file: SourceFile = createSourceFile("inline-content.ts", fileContent.toString(), ScriptTarget.ES2017);
    return file.getChildAt(0);
  }
}