import type { Meta, StoryObj } from "@storybook/react-vite";

import YamlEditor from "./YamlEditor";

const sampleYaml = `# Helm chart values
replicaCount: 3
image:
  repository: nginx
  tag: "1.21.0"
  pullPolicy: IfNotPresent
service:
  type: ClusterIP
  port: 80
resources:
  limits:
    cpu: 500m
    memory: 512Mi
ingress:
  enabled: true
  hosts:
    - host: example.com
      paths:
        - path: /
          pathType: Prefix`;

const meta = {
  title: "YamlEditor",
  component: YamlEditor,
} satisfies Meta<typeof YamlEditor>;

export default meta;

export const Editable: StoryObj<typeof YamlEditor> = {
  args: {
    value: sampleYaml,
    readOnly: false,
    height: "330px",
  },
  argTypes: {
    onChange: { action: "changed" },
  },
};

export const ReadOnly: StoryObj<typeof YamlEditor> = {
  args: {
    value: sampleYaml,
    readOnly: true,
    height: "330px",
  },
};

export const DarkEditable: StoryObj<typeof YamlEditor> = {
  args: {
    value: sampleYaml,
    readOnly: false,
    height: "330px",
  },
  parameters: {
    // Hint to start with dark theme; the toggle persists via localStorage.
    docs: {
      description:
        "Dark variant (Tokyo Night). Click the 'Dark/Light' toggle button below the editor to switch.",
    },
  },
};
