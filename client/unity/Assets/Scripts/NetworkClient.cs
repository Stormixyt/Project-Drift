using System;
using System.Collections.Generic;
using UnityEngine;

namespace ProjectDrift.Client.Network
{
    /// <summary>
    /// Handles client-side networking with the authoritative game server.
    /// Implements client-side prediction and server reconciliation.
    /// </summary>
    public class NetworkClient : MonoBehaviour
    {
        [Header("Server Connection")]
        [SerializeField] private string serverAddress = "127.0.0.1";
        [SerializeField] private int serverPort = 7777;
        [SerializeField] private string authToken;

        [Header("Network Settings")]
        [SerializeField] private int tickRate = 60;
        [SerializeField] private float sendRate = 30f; // Inputs per second
        [SerializeField] private int maxBufferedSnapshots = 32;

        // Connection state
        private bool isConnected = false;
        private ulong currentTick = 0;

        // Input buffering
        private Queue<PlayerInput> pendingInputs = new Queue<PlayerInput>();
        private List<PlayerInput> sentInputs = new List<PlayerInput>();

        // Snapshot buffering
        private Queue<ServerSnapshot> receivedSnapshots = new Queue<ServerSnapshot>();

        // Client prediction
        private PlayerState predictedState;
        private PlayerState confirmedState;

        private void Start()
        {
            Application.targetFrameRate = tickRate;
            predictedState = new PlayerState();
            confirmedState = new PlayerState();
        }

        private void Update()
        {
            if (!isConnected) return;

            currentTick++;

            // Gather input
            PlayerInput input = GatherInput();
            input.tick = currentTick;

            // Store input for reconciliation
            pendingInputs.Enqueue(input);
            sentInputs.Add(input);

            // Client-side prediction
            ApplyInput(ref predictedState, input);

            // Send input to server (at sendRate)
            if (Time.frameCount % Mathf.RoundToInt(tickRate / sendRate) == 0)
            {
                SendInputToServer(input);
            }

            // Process received snapshots
            ProcessSnapshots();
        }

        /// <summary>
        /// Gather player input for this frame
        /// </summary>
        private PlayerInput GatherInput()
        {
            return new PlayerInput
            {
                forward = Input.GetKey(KeyCode.W),
                backward = Input.GetKey(KeyCode.S),
                left = Input.GetKey(KeyCode.A),
                right = Input.GetKey(KeyCode.D),
                jump = Input.GetKey(KeyCode.Space),
                lookDelta = new Vector3(Input.GetAxis("Mouse X"), Input.GetAxis("Mouse Y"), 0),
                tick = currentTick
            };
        }

        /// <summary>
        /// Apply input to player state (client-side prediction)
        /// </summary>
        private void ApplyInput(ref PlayerState state, PlayerInput input)
        {
            float dt = 1f / tickRate;

            // Movement
            Vector3 forward = state.rotation * Vector3.forward;
            Vector3 right = state.rotation * Vector3.right;
            Vector3 movement = Vector3.zero;

            if (input.forward) movement += forward;
            if (input.backward) movement -= forward;
            if (input.right) movement += right;
            if (input.left) movement -= right;

            if (movement.magnitude > 0)
            {
                movement.Normalize();
                state.velocity = movement * 10f; // Move speed
            }

            // Apply velocity
            state.position += state.velocity * dt;

            // Rotation
            state.rotation *= Quaternion.Euler(input.lookDelta * 0.1f);

            // Jump
            if (input.jump && state.isGrounded)
            {
                state.velocity.y = 5f;
                state.isGrounded = false;
            }

            // Gravity
            if (!state.isGrounded)
            {
                state.velocity.y += Physics.gravity.y * dt;
            }

            // Ground check
            if (state.position.y <= 0)
            {
                state.position.y = 0;
                state.velocity.y = 0;
                state.isGrounded = true;
            }
        }

        /// <summary>
        /// Process snapshots received from server and reconcile
        /// </summary>
        private void ProcessSnapshots()
        {
            while (receivedSnapshots.Count > 0)
            {
                ServerSnapshot snapshot = receivedSnapshots.Dequeue();

                // Update confirmed state
                confirmedState.position = snapshot.position;
                confirmedState.rotation = snapshot.rotation;
                confirmedState.velocity = snapshot.velocity;
                confirmedState.isGrounded = snapshot.isGrounded;

                // Reconciliation: replay inputs since confirmed tick
                predictedState = confirmedState;
                foreach (var input in sentInputs)
                {
                    if (input.tick > snapshot.tick)
                    {
                        ApplyInput(ref predictedState, input);
                    }
                }

                // Remove old inputs
                sentInputs.RemoveAll(i => i.tick <= snapshot.tick);
            }
        }

        /// <summary>
        /// Send player input to server via UDP
        /// </summary>
        private void SendInputToServer(PlayerInput input)
        {
            // TODO: Implement UDP send using QUIC
            // This would serialize the input and send to server
            Debug.Log($"Sending input for tick {input.tick}");
        }

        /// <summary>
        /// Called when snapshot is received from server
        /// </summary>
        public void OnSnapshotReceived(ServerSnapshot snapshot)
        {
            receivedSnapshots.Enqueue(snapshot);

            // Limit buffer size
            while (receivedSnapshots.Count > maxBufferedSnapshots)
            {
                receivedSnapshots.Dequeue();
            }
        }

        /// <summary>
        /// Connect to game server
        /// </summary>
        public void Connect(string address, int port, string token)
        {
            serverAddress = address;
            serverPort = port;
            authToken = token;

            // TODO: Implement QUIC connection
            Debug.Log($"Connecting to {serverAddress}:{serverPort}");
            isConnected = true;
        }

        /// <summary>
        /// Disconnect from server
        /// </summary>
        public void Disconnect()
        {
            isConnected = false;
            Debug.Log("Disconnected from server");
        }

        public Vector3 GetPredictedPosition() => predictedState.position;
        public Quaternion GetPredictedRotation() => predictedState.rotation;
    }

    [Serializable]
    public struct PlayerInput
    {
        public bool forward;
        public bool backward;
        public bool left;
        public bool right;
        public bool jump;
        public Vector3 lookDelta;
        public ulong tick;
    }

    [Serializable]
    public struct PlayerState
    {
        public Vector3 position;
        public Quaternion rotation;
        public Vector3 velocity;
        public bool isGrounded;
    }

    [Serializable]
    public struct ServerSnapshot
    {
        public ulong tick;
        public Vector3 position;
        public Quaternion rotation;
        public Vector3 velocity;
        public bool isGrounded;
    }
}
