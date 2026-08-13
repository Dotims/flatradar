# Running Overheads unattended

Two systemd user units, for the half of the work that cannot run in the cloud: OLX
answers 403 from datacenter addresses, so it is collected here while Otodom is collected
by GitHub Actions. Nothing is lost while this machine is off except OLX.

User units rather than system ones: this reads a hosted database and serves a page on
loopback, so it has no business running as root or before anyone has logged in.

Both assume the repo is at `~/Desktop/projects/overheads`. If it lives elsewhere, edit
`WorkingDirectory` in the two `.service` files.

## Install

```bash
mkdir -p ~/.config/systemd/user
cp deploy/*.service deploy/*.timer ~/.config/systemd/user/
systemctl --user daemon-reload

systemctl --user enable --now overheads-collect.timer   # OLX every 15 minutes
systemctl --user enable --now overheads-api.service     # keep the dashboard's API up
```

Collection stops when you log out unless lingering is on:

```bash
sudo loginctl enable-linger "$USER"
```

## Check on it

```bash
systemctl --user list-timers overheads-collect.timer   # when it last ran and runs next
systemctl --user status overheads-collect.service      # how the last round went
journalctl --user -u overheads-collect.service -n 50   # what it printed
```

A round that fails is left failed on purpose, so `status` shows a problem rather than a
silence. One portal failing does not stop the other, and classification runs either way.

## Run one round by hand

```bash
systemctl --user start overheads-collect.service
# or, without systemd in the way:
pnpm collect
```

## Stop it

```bash
systemctl --user disable --now overheads-collect.timer overheads-api.service
```
