import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as github from '@actions/github';
import * as glob from '@actions/glob';
import * as fs from 'fs/promises';
import * as yaml from 'js-yaml';
import { FidalgoEnvironment, Project } from './types';

const DEFAULT_FIDALGO_EXTENSION = 'https://fidalgosetup.blob.core.windows.net/cli-extensions/fidalgo-0.3.2-py3-none-any.whl';

function getNameAndType(): { name: string, type: string; } {

    const context = github.context;

    const part_ref = context.eventName === 'pull_request' ? 'pr' : 'branch';
    const name_part = context.eventName === 'pull_request' ? context.issue.number : context.eventName === 'push' ? context.ref.split('/').slice(-1)[0] : context.ref;
    const suffix_part = context.payload.repository!['id'];

    const env_name = `ci-${part_ref}-${name_part}-${suffix_part}`;

    core.info(`Setting environment name: ${env_name}`);
    core.setOutput('name', env_name);

    let env_type = 'Dev';

    if (context.eventName === 'push') {
        env_type = context.payload.ref === 'refs/heads/main' ? 'Prod' : 'Dev';
    } else if (context.eventName === 'pull_request') {
        env_type = context.payload.pull_request?.base.ref == 'main' && 'Pre-Prod' || 'Test';
    }

    core.info(`Setting environment type: ${env_type}`);
    core.setOutput('type', env_type);

    return { name: env_name, type: env_type };
}

async function run(): Promise<void> {
    try {

        const env_name = core.getInput('name', { required: true });
        const env_type = core.getInput('type', { required: true });

        const pattern = core.getInput('project');

        core.info(`project input: ${pattern}`);

        const globber = await glob.create(pattern);
        const files = await globber.glob();

        const file = files.length > 0 ? files[0] : undefined;

        if (file) {

            let fidalgoExt = DEFAULT_FIDALGO_EXTENSION;

            core.info(`Found project.yml file: ${file}`);

            const contents = await fs.readFile(file, 'utf8');
            const project = yaml.load(contents) as Project;

            // allow for override of tenant
            if (project.tenant) {
                core.info(`Found tenant id in project.yml file: ${project.tenant}`);
                core.setOutput('tenant', project.tenant);
            } else {
                // attempt to get tenant from azure using service principal
                core.info('No tenant id found in project.yml file, attempting to get from Azure');

                const tenantId = await exec.getExecOutput('az', ['account', 'show', '--query', 'tenantId', '-o', 'tsv']);

                if (tenantId.stdout) {
                    core.info(`Found tenant with id: ${tenantId.stdout}`);
                    core.setOutput('tenant', tenantId.stdout);
                } else {
                    core.setFailed(`Failed to get tenant id from Azure: ${tenantId.stderr}`);
                }
            }

            if (project.fidalgo) {
                core.info('Found fidalgo section in project.yml file');

                // allow for override of extension
                if (project.fidalgo.extension) {
                    fidalgoExt = project.fidalgo.extension;
                    core.info(`Found fidalgo extension in project.yml file: ${fidalgoExt}`);
                } else {
                    // use default extension
                    core.info(`No fidalgo extension found in project.yml file, using default: ${fidalgoExt}`);
                }

                core.setOutput('fidalgo', fidalgoExt);

                if (project.fidalgo.project) {
                    core.info('Found fidalgo project section in project.yml file');

                    if (project.fidalgo.project.name) {
                        core.info(`Found fidalgo project name in project.yml file: ${project.fidalgo.project.name}`);
                        core.setOutput('project_name', project.fidalgo.project.name);
                    } else {
                        core.setFailed(`Could not get fidalgo project name from project.yml: ${contents}`);
                    }

                    if (project.fidalgo.project.group) {
                        core.info(`Found fidalgo project group in project.yml file: ${project.fidalgo.project.group}`);
                        core.setOutput('project_group', project.fidalgo.project.group);
                    } else {
                        core.setFailed(`Could not get fidalgo project group from project.yml: ${contents}`);
                    }

                    if (project.fidalgo.catalog_item) {
                        core.info(`Found fidalgo catalog item in project.yml file: ${project.fidalgo.catalog_item}`);
                        core.setOutput('catalog_item', project.fidalgo.catalog_item);
                    } else {
                        core.setFailed(`Could not get fidalgo catalog item from project.yml: ${contents}`);
                    }
                } else {
                    core.setFailed(`No fidalgo project section found in project.yml file: ${contents}`);
                }
            } else {
                core.setFailed(`No fidalgo section found in project.yml file: ${contents}`);
            }

            await exec.exec('az', ['extension', 'add', '--only-show-errors', '-y', '-s', fidalgoExt]);

            const environmentShow = await exec.getExecOutput('az', ['fidalgo', 'admin', 'environment', 'show', '--only-show-errors', '-g', project.fidalgo.project.group, '--project-name', project.fidalgo.project.name, '-n', env_name], { ignoreReturnCode: true });
            // const environment = await exec.getExecOutput('az', ['fidalgo', 'admin', 'environment', 'show', '-g', project.fidalgo.project.group, '--project-name', project.fidalgo.project.name, '-n', 'foo'], { ignoreReturnCode: true });

            let exists = false;
            let created = false;

            if (environmentShow.exitCode === 0) {
                exists = true;
                core.info('Found existing environment');
                const environment = JSON.parse(environmentShow.stdout) as FidalgoEnvironment;
                core.setOutput('group', environment.resourceGroupId);
            } else {

                const createIfNotExists = core.getBooleanInput('createIfNotExists');
                core.info(`createIfNotExists: ${createIfNotExists}`);

                if (createIfNotExists) {
                    core.info('Creating environment');
                    const create = await exec.getExecOutput('az', ['fidalgo', 'admin', 'environment', 'create', '--only-show-errors', '-g', project.fidalgo.project.group, '--project-name', project.fidalgo.project.name, '-n', env_name, '--environment-type', env_name, '--catalog-item-name', project.fidalgo.catalog_item], { ignoreReturnCode: true });
                    if (create.exitCode === 0) {
                        exists = true;
                        created = true;
                        core.info('Created environment');
                        const environment = JSON.parse(create.stdout) as FidalgoEnvironment;
                        core.setOutput('group', environment.resourceGroupId);
                    } else {
                        core.setFailed(`Failed to create environment: ${create.stderr}`);
                    }
                } else {
                    core.info(`No existing environment found: code: ${environmentShow.exitCode}`);
                }
            }

            core.setOutput('exists', exists);
            core.setOutput('created', created);

        } else {
            core.setFailed(`Could not find project.yml file with specified glob: ${pattern}`);
        }
    } catch (error) {
        if (error instanceof Error) core.setFailed(error.message);
    }
}

run();