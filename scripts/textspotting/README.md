```bash
$ docker build -t necessary_reunions_textspotting:latest .
```

Use --gpus all if you have a fancy GPU

```bash
$ docker run -it --rm \
    -v /data/globalise/maps/necessary_reunions/textspotting/images:/home/mapreader/images \
    -v /data/globalise/maps/necessary_reunions/textspotting/results:/home/mapreader/results \
    --runtime=nvidia --gpus device=2 \
    necessary_reunions_textspotting:latest \
    bash
```

```bash
$ python spot_text.py images/NL-HaNA_4.VELH_156.2.12.jpg
```
