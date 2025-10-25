using UnityEngine;
using UnityEngine.UI;
using TMPro;
using System.IO;
using System.Collections;
using System.Collections.Generic;

namespace ProjectDrift.Client.UI
{
    /// <summary>
    /// Launcher UI for importing custom game builds.
    /// Handles both GitHub URL imports and local file imports.
    /// </summary>
    public class BuildImporter : MonoBehaviour
    {
        [Header("UI References")]
        [SerializeField] private GameObject importPanel;
        [SerializeField] private TMP_InputField githubUrlInput;
        [SerializeField] private Button importFromGithubButton;
        [SerializeField] private Button importFromFileButton;
        [SerializeField] private TMP_Text statusText;
        [SerializeField] private Slider progressSlider;
        [SerializeField] private Transform buildListContainer;
        [SerializeField] private GameObject buildItemPrefab;

        [Header("Settings")]
        [SerializeField] private string buildsDirectory = "Builds";
        [SerializeField] private string metadataFileName = "build.json";

        private List<BuildMetadata> importedBuilds = new List<BuildMetadata>();

        private void Start()
        {
            // Create builds directory if it doesn't exist
            if (!Directory.Exists(buildsDirectory))
            {
                Directory.CreateDirectory(buildsDirectory);
            }

            // Setup button listeners
            importFromGithubButton.onClick.AddListener(OnImportFromGithub);
            importFromFileButton.onClick.AddListener(OnImportFromFile);

            // Load existing builds
            LoadImportedBuilds();

            // Hide import panel by default
            importPanel.SetActive(false);
        }

        /// <summary>
        /// Show the import panel
        /// </summary>
        public void ShowImportPanel()
        {
            importPanel.SetActive(true);
            githubUrlInput.text = "";
            statusText.text = "";
            progressSlider.value = 0;
        }

        /// <summary>
        /// Hide the import panel
        /// </summary>
        public void HideImportPanel()
        {
            importPanel.SetActive(false);
        }

        /// <summary>
        /// Import build from GitHub repository
        /// </summary>
        private void OnImportFromGithub()
        {
            string url = githubUrlInput.text.Trim();

            if (string.IsNullOrEmpty(url))
            {
                statusText.text = "Please enter a valid GitHub URL";
                return;
            }

            StartCoroutine(ImportFromGithubCoroutine(url));
        }

        /// <summary>
        /// Import build from local file
        /// </summary>
        private void OnImportFromFile()
        {
            // TODO: Implement file picker for Windows
            // For now, show file dialog using Unity's EditorUtility (editor only)
            #if UNITY_EDITOR
            string path = UnityEditor.EditorUtility.OpenFilePanel("Select Build File", "", "exe,zip");
            if (!string.IsNullOrEmpty(path))
            {
                StartCoroutine(ImportFromFileCoroutine(path));
            }
            #else
            statusText.text = "File import not yet implemented for standalone builds";
            #endif
        }

        /// <summary>
        /// Download and import build from GitHub
        /// </summary>
        private IEnumerator ImportFromGithubCoroutine(string url)
        {
            statusText.text = "Downloading from GitHub...";
            progressSlider.value = 0.1f;

            // TODO: Implement GitHub API integration
            // 1. Parse GitHub URL to extract owner/repo/release
            // 2. Use GitHub API to get release assets
            // 3. Download build files
            // 4. Verify checksums
            // 5. Extract to builds directory
            // 6. Create metadata file

            yield return new WaitForSeconds(2f); // Simulated download

            progressSlider.value = 0.5f;
            statusText.text = "Verifying build...";

            yield return new WaitForSeconds(1f);

            progressSlider.value = 1f;
            statusText.text = "Build imported successfully!";

            // Create mock metadata
            BuildMetadata metadata = new BuildMetadata
            {
                name = "Fortnite Chapter 1",
                version = "1.11",
                sourceUrl = url,
                importedAt = System.DateTime.Now.ToString(),
                verified = true
            };

            SaveBuildMetadata(metadata);
            LoadImportedBuilds();

            yield return new WaitForSeconds(2f);
            HideImportPanel();
        }

        /// <summary>
        /// Import build from local file
        /// </summary>
        private IEnumerator ImportFromFileCoroutine(string filePath)
        {
            statusText.text = "Importing from file...";
            progressSlider.value = 0.2f;

            // TODO: Implement file import
            // 1. Copy file to builds directory
            // 2. If ZIP, extract contents
            // 3. Scan for executable and required files
            // 4. Create metadata

            yield return new WaitForSeconds(2f);

            progressSlider.value = 1f;
            statusText.text = "Build imported successfully!";

            BuildMetadata metadata = new BuildMetadata
            {
                name = Path.GetFileNameWithoutExtension(filePath),
                version = "Unknown",
                sourceUrl = filePath,
                importedAt = System.DateTime.Now.ToString(),
                verified = false
            };

            SaveBuildMetadata(metadata);
            LoadImportedBuilds();

            yield return new WaitForSeconds(2f);
            HideImportPanel();
        }

        /// <summary>
        /// Load all imported builds from disk
        /// </summary>
        private void LoadImportedBuilds()
        {
            importedBuilds.Clear();

            // Clear build list UI
            foreach (Transform child in buildListContainer)
            {
                Destroy(child.gameObject);
            }

            // Find all build directories
            if (!Directory.Exists(buildsDirectory)) return;

            string[] buildDirs = Directory.GetDirectories(buildsDirectory);

            foreach (string dir in buildDirs)
            {
                string metadataPath = Path.Combine(dir, metadataFileName);
                if (File.Exists(metadataPath))
                {
                    string json = File.ReadAllText(metadataPath);
                    BuildMetadata metadata = JsonUtility.FromJson<BuildMetadata>(json);
                    importedBuilds.Add(metadata);

                    // Create UI item
                    CreateBuildListItem(metadata);
                }
            }

            Debug.Log($"Loaded {importedBuilds.Count} builds");
        }

        /// <summary>
        /// Create UI list item for a build
        /// </summary>
        private void CreateBuildListItem(BuildMetadata metadata)
        {
            GameObject item = Instantiate(buildItemPrefab, buildListContainer);
            
            // Set build info
            TMP_Text nameText = item.transform.Find("NameText").GetComponent<TMP_Text>();
            TMP_Text versionText = item.transform.Find("VersionText").GetComponent<TMP_Text>();
            Button playButton = item.transform.Find("PlayButton").GetComponent<Button>();

            nameText.text = metadata.name;
            versionText.text = $"v{metadata.version}";

            playButton.onClick.AddListener(() => LaunchBuild(metadata));
        }

        /// <summary>
        /// Launch a build (sandboxed execution)
        /// </summary>
        private void LaunchBuild(BuildMetadata metadata)
        {
            Debug.Log($"Launching build: {metadata.name}");
            statusText.text = $"Launching {metadata.name}...";

            // TODO: Implement sandboxed build execution
            // 1. Create isolated process with resource limits
            // 2. Monitor for crashes
            // 3. Provide IPC for build to communicate with launcher
        }

        /// <summary>
        /// Save build metadata to disk
        /// </summary>
        private void SaveBuildMetadata(BuildMetadata metadata)
        {
            string buildDir = Path.Combine(buildsDirectory, metadata.name);
            if (!Directory.Exists(buildDir))
            {
                Directory.CreateDirectory(buildDir);
            }

            string metadataPath = Path.Combine(buildDir, metadataFileName);
            string json = JsonUtility.ToJson(metadata, true);
            File.WriteAllText(metadataPath, json);
        }
    }

    [System.Serializable]
    public class BuildMetadata
    {
        public string name;
        public string version;
        public string sourceUrl;
        public string importedAt;
        public bool verified;
        public string checksum;
        public long sizeBytes;
    }
}
