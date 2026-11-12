import { changeProjectStatus, Project } from '../projectApi';

export function publishProject(projectId: string): Promise<Project> {
  return changeProjectStatus(projectId, 'publish');
}
